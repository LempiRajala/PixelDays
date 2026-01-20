/*
 * Renders Markdown that got parsed by core/MarkdownParser
 */
import React from 'react';

import MdLink from './MdLink.jsx';
import MdMention from './MdMention.jsx';
import { parseParagraph } from '../../utils/markdown/MarkdownParser.js';

/**
 * parse a markdown paragraph,
 * either text or pArray should be given, not both
 * @param {
 *   text: markdown text
 *   pArray: parsed markdown array
 *   refEmbed: a reference to the element where we can attach an embed to
 * }
 */
const MdParagraph = ({
  text,
  pArray,
  refEmbed,
}: {
  text?: string;
  pArray?: string[];
  refEmbed?: React.MutableRefObject<HTMLLIElement | null>;
}) => {
  if (!pArray) {
    if (!text) {
      return null;
    }
    pArray = parseParagraph(text);
  }

  return pArray!.map((part, i) => {
    if (!Array.isArray(part)) {
      return part;
    }
    const type = part[0];
    switch (type) {
      case 'c':
        return (<code key={i}>{part[1]}</code>);
      case '*':
        return (
          <strong key={i}>
            <MdParagraph pArray={part[1]} />
          </strong>
        );
      case '~':
        return (
          <s key={i}>
            <MdParagraph pArray={part[1]} />
          </s>
        );
      case '+':
        return (
          <em key={i}>
            <MdParagraph pArray={part[1]} />
          </em>
        );
      case '_':
        return (
          <u key={i}>
            <MdParagraph pArray={part[1]} />
          </u>
        );
      case 'img':
      case 'l': {
        return (
          <MdLink key={i} refEmbed={refEmbed} href={part[2]} title={part[1]} />
        );
      }
      case '@': {
        return (
          <MdMention key={i} uid={part[2]} name={part[1]} />
        );
      }
      default:
        return type;
    }
  });
};

export default React.memo(MdParagraph);
