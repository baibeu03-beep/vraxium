"use client";

import Image from "next/image";
import { useState } from "react";
import ytbIcon from "@/public/images/0/sns-icon-ytb.webp";
import cafeIcon from "@/public/images/0/sns-icon-cafe.png";

const Social = () => {
  const [active, setActive] = useState("");
  return (
    <ul className="social">
      <li>
        <a href="https://www.instagram.com/oranke_marketing.club/" target="_blank" aria-label="follow us on instagram" onMouseOver={() => setActive("instagram")} title="instagram" className={`social-btn social-btn-instagram ${active == "instagram" ? "social-btn-active" : ""}`}>
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
      <li>
        <a href="https://www.youtube.com/channel/UC1bcCjcN9xUkDtIPaFPUrsw" target="_blank" aria-label="watch us on youtube" onMouseOver={() => setActive("youtube")} title="youtube" className={`social-btn ${active == "youtube" ? "social-btn-active" : ""}`}>
          <Image src={ytbIcon} alt="YouTube" width={20} height={20} className="social-icon-img" />
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
        <a href="https://cafe.naver.com/oranke" target="_blank" aria-label="visit our naver cafe" onMouseOver={() => setActive("cafe")} title="naver cafe" className={`social-btn ${active == "cafe" ? "social-btn-active" : ""}`}>
          <Image src={cafeIcon} alt="Naver Cafe" width={24} height={24} className="social-icon-img social-icon-cafe" />
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
        <a href="#" className="social-btn" onMouseOver={() => setActive("")}>
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
