/*
 * Renders Markdown that got parsed by core/MarkdownParser
 */
import React from 'react';

import MdParagraph from './MdParagraph.tsx';
import { parse } from '../../utils/markdown/MarkdownParser.js';

/**
 * parse a markdown article, an article can have multiple paragraphs
 * either text or mdArray should be given, not both
 * @param {
 *   text: markdown text
 *   mdArray: parsed markdown array
 *   refEmbed: a reference to the element where we can attach an embed to
 * }
 */
const Markdown = ({ text, mdArray, parseLinks = false }) => {
  if (!mdArray) {
    if (!text) {
      return null;
    }
    mdArray = parse(text, { parseLinks });
  }

  const markdown = mdArray.map((part) => {
    const type = part[0];
    switch (type) {
      /* Heading */
      case 'a': {
        const level = Number(part[1]);
        const heading = part[2];
        const children = part[3];
        let headingElem = [];
        switch (level) {
          case 1:
            headingElem = <h1>{heading}</h1>;
            break;
          case 2:
            headingElem = <h2>{heading}</h2>;
            break;
          case 3:
            headingElem = <h3>{heading}</h3>;
            break;
          default:
            headingElem = <h4>{heading}</h4>;
        }
        return (
          <>
            {headingElem}
            <section>
              <Markdown mdArray={children} />
            </section>
          </>
        );
      }
      /* Paragraph */
      case 'p': {
        return (
          <p>
            <MdParagraph pArray={part[1]} />
          </p>
        );
      }
      /* Code Block */
      case 'cb': {
        const content = part[1];
        return <pre>{content}</pre>;
      }
      case '>':
      case '<': {
        const children = part[1];
        return (
          <blockquote
            className={(type === '>') ? 'gt' : 'rt'}
          >
            <Markdown mdArray={children} />
          </blockquote>
        );
      }
      case 'ul': {
        const children = part[1];
        return (
          <ul>
            <Markdown mdArray={children} />
          </ul>
        );
      }
      case 'ol': {
        const children = part[1];
        return (
          <ol>
            <Markdown mdArray={children} />
          </ol>
        );
      }
      case '-': {
        const children = part[1];
        return (
          <li>
            <Markdown mdArray={children} />
          </li>
        );
      }
      default:
        return part[0];
    }
  });

  return (
    <article>
      {markdown}
    </article>
  );
};

export default React.memo(Markdown);
