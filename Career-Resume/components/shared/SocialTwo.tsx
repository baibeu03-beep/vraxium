"use client";

import { useState } from "react";

const SocialTwo = () => {
  const [active, setActive] = useState("twitter");

  const socialLinks = [
    { href: "https://www.facebook.com/", ariaLabel: "follow us on facebook", title: "facebook", icon: "ti-brand-facebook" },
    { href: "https://www.twitter.com/", ariaLabel: "follow us on twitter", title: "twitter", icon: "ti-brand-twitter" },
    { href: "https://www.twitch.tv/", ariaLabel: "watch us on twitch", title: "Twitch", icon: "ti-brand-twitch" },
    { href: "https://www.instagram.com/", ariaLabel: "follow us on instagram", title: "instagram", icon: "ti-brand-instagram" },
  ];

  return (
    <ul className="social">
      {socialLinks.map((link, index) => (
        <li key={index}>
          <a href={link.href} target="_blank" aria-label={link.ariaLabel} title={link.title} className={`social-btn ${link.title === active ? "social-btn-active" : ""}`} onMouseOver={() => setActive(link.title)}>
            <i className={`ti ${link.icon}`}></i>
          </a>
        </li>
      ))}
    </ul>
  );
};

export default SocialTwo;
