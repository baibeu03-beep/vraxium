"use client";

import { useState } from "react";

const Social = () => {
  const [active, setActive] = useState("twitter");
  return (
    <ul className="social">
      <li>
        <a href="https://www.facebook.com/" target="_blank" aria-label="follow us on facebook" onMouseOver={() => setActive("facebook")} title="facebook" className={`"social-btn ${active == "facebook" && "social-btn-active"}`}>
          <i className="ti ti-brand-facebook"></i>
          <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <span className="ba"></span>
          <span className="ba-two"></span>
        </a>
      </li>
      <li>
        <a href="https://www.twitter.com/" target="_blank" aria-label="follow us on twitter" onMouseOver={() => setActive("twitter")} title="twitter" className={`"social-btn ${active == "twitter" && "social-btn-active"}`}>
          <i className="ti ti-brand-twitter"></i>
          <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <span className="ba"></span>
          <span className="ba-two"></span>
        </a>
      </li>
      <li>
        <a href="https://www.twitch.tv/" target="_blank" aria-label="watch us on twitch" onMouseOver={() => setActive("twitch")} title="Twitch" className={`"social-btn ${active == "twitch" && "social-btn-active"}`}>
          <i className="ti ti-brand-twitch"></i>
          <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <span className="ba"></span>
          <span className="ba-two"></span>
        </a>
      </li>
      <li>
        <a href="https://www.instagram.com/" target="_blank" aria-label="follow us on instagram" onMouseOver={() => setActive("instagram")} title="instagram" className={`"social-btn ${active == "instagram" && "social-btn-active"}`}>
          <i className="ti ti-brand-instagram"></i>
          <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
          </svg>
          <span className="ba"></span>
          <span className="ba-two"></span>
        </a>
      </li>
    </ul>
  );
};

export default Social;
