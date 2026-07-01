// features/home/TeamScroll.jsx
import React from 'react';

export function TeamScroll({ members }) {
  return (
    <section id="team" className="section reveal">
      <span className="sec-label">Faculty</span>
      <h2 className="section-title">Meet the Minds Behind the Platform</h2>
      <p className="section-subtitle">
        Distinguished pharmacologists, molecular biologists, and clinical researchers with decades of combined teaching experience.
      </p>
      <div className="team-scroll-container">
        {(members || []).filter(Boolean).map(member => (
          <div key={member.name} className="team-card team-card-min">
            <div className="team-avatar">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.name} />
              ) : (
                <i className="fa-solid fa-user-tie"></i>
              )}
            </div>
            <h3>{member.name}</h3>
            <div className="team-title">{member.title || 'Faculty Member'}</div>
            <p>{member.bio}</p>
            <div className="team-social">
              {member.linkedin && <a href={member.linkedin} target="_blank" rel="noreferrer"><i className="fa-brands fa-linkedin-in"></i></a>}
              {member.twitter && <a href={member.twitter} target="_blank" rel="noreferrer"><i className="fa-brands fa-x-twitter"></i></a>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
