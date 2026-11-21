// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Returns exactly csv-reader 1.0.0's answer for every input {text, header}:
// {columns, rows, errors}. The semantics are copied from the reference
// (baselines/csv-reader/vendor/csv-reader/index.js in the kit):
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not
//     doubled ("" inside it is one quote, each CRLF or lone CR inside it is
//     read as LF); what follows its closing quote, up to the next comma or
//     line break, is appended as it stands (quote_junk, when the field ends);
//     a quote that never closes is a literal character and the text after it
//     is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - columns is the first record when header is true, else null; rows are
//     padded with "" (short_row, with fields: its field count) or cut
//     (long_row, with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row} in the order met; line is the 1-based
//     line its record starts on, row its record's index in rows (null for
//     the header).
//
// Speed: the reference reads one character at a time and builds every field
// a character at a time. This reads the same way, once, left to right, but
// scans with charCodeAt loops and builds each field out of slices of the
// input, so a field costs one slice (a view onto the input) instead of one
// string concatenation per character. No regex, no split, no allocation on
// the hot path beyond the field strings, row arrays and error objects the
// answer itself needs.

const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    // The record being read: the line it starts on and the index in rows
    // it takes (null: the header).
    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;

    const fields = [];
    let quoted = false;
    let ended = END;

    while (true) {
      // One field. `tail` runs the unquoted read below: a plain unquoted
      // field, the junk after a closing quote, or the re-read of a field
      // whose quote never closed.
      let value;
      let tail = false;
      let junk = false;

      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const open = pos;
        const openLine = line;
        pos += 1;
        let v = '';
        let seg = pos; // start of the current slice of the quoted field
        let closed = false;
        while (pos < n) {
          const c = text.charCodeAt(pos);
          if (c === 34) {
            if (pos + 1 < n && text.charCodeAt(pos + 1) === 34) {
              // Doubled quote: one quote.
              v += text.slice(seg, pos);
              v += '"';
              pos += 2;
              seg = pos;
              continue;
            }
            // Closing quote.
            v += text.slice(seg, pos);
            pos += 1;
            closed = true;
            break;
          }
          if (c === 13) {
            // CRLF and a lone CR inside quotes are each one LF.
            v += text.slice(seg, pos);
            v += '\n';
            line += 1;
            pos += pos + 1 < n && text.charCodeAt(pos + 1) === 10 ? 2 : 1;
            seg = pos;
            continue;
          }
          if (c === 10) {
            v += text.slice(seg, pos);
            v += '\n';
            line += 1;
            pos += 1;
            seg = pos;
            continue;
          }
          pos += 1;
        }
        if (!closed) {
          // The quote never closes: it is a literal character, and the
          // text after it is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          value = '"';
          tail = true;
        } else if (pos >= n) {
          value = v;
          ended = END;
        } else {
          const c = text.charCodeAt(pos);
          if (c === 44) {
            pos += 1;
            value = v;
            ended = COMMA;
          } else if (c === 10) {
            pos += 1;
            line += 1;
            value = v;
            ended = BREAK;
          } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
            pos += 2;
            line += 1;
            value = v;
            ended = BREAK;
          } else {
            // What follows the closing quote is appended as it stands.
            value = v;
            tail = true;
            junk = true;
          }
        }
      } else {
        quoted = false;
        value = '';
        tail = true;
      }

      if (tail) {
        // Unquoted read onto `value`: a CR not followed by LF is dropped
        // (stray_cr). `added` counts the characters kept, for quote_junk.
        let start = pos;
        let added = 0;
        ended = END;
        while (pos < n) {
          const c = text.charCodeAt(pos);
          // Most field characters are letters or digits (above the
          // delimiters' codes), so one comparison rules them out.
          if (c < 45 && (c === 44 || c === 10 || c === 13)) {
            if (c === 44) {
              value += text.slice(start, pos);
              added += pos - start;
              pos += 1;
              ended = COMMA;
              break;
            }
            if (c === 10) {
              value += text.slice(start, pos);
              added += pos - start;
              pos += 1;
              line += 1;
              ended = BREAK;
              break;
            }
            if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
              value += text.slice(start, pos);
              added += pos - start;
              pos += 2;
              line += 1;
              ended = BREAK;
              break;
            }
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            value += text.slice(start, pos);
            added += pos - start;
            pos += 1;
            start = pos;
            continue;
          }
          pos += 1;
        }
        // The loop only leaves `ended` at END when it ran out of text.
        if (ended === END) {
          value += text.slice(start, pos);
          added += pos - start;
        }
        if (junk && added > 0) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
      }

      fields.push(value);
      if (ended !== COMMA) break;
    }

    // A line that held only stray CRs is left with no characters: no
    // record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
