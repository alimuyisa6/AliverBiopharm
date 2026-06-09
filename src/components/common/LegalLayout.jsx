 import React from 'react';
import '../../pages/legal/legal.css';

function linkifyEmail(text) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts = text.split(emailRegex);
  return parts.map((part, i) => 
    emailRegex.test(part) ? <a key={i} href={`mailto:${part}`}>{part}</a> : part
  );
}

export default function LegalLayout({ title, lastUpdated, children }) {
  return (
    <div className="legal-page">
      <h1>{title}</h1>
      <div className="last-updated">Last updated: {lastUpdated}</div>
      <div>
        {React.Children.map(children, child => {
          if (React.isValidElement(child) && child.type === 'section') {
            return React.cloneElement(child, {
              children: React.Children.map(child.props.children, subChild => {
                if (React.isValidElement(subChild) && subChild.type === 'p') {
                  const text = subChild.props.children;
                  if (typeof text === 'string') {
                    return <p>{linkifyEmail(text)}</p>;
                  }
                }
                return subChild;
              })
            });
          }
          return child;
        })}
      </div>
    </div>
  );
}
