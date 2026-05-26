"use client";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { useState } from "react";
import AnimateHeight from "react-animate-height";

interface Author {
  name: string;
  image: StaticImageData | string;
  profileLink: string;
}

interface CommentProps {
  id: number;
  author: Author;
  date: string;
  content: string;
}

const CommentSingle: React.FC<CommentProps> = ({ author, date, content }) => {
  const [reply, setReply] = useState(false);
  return (
    <div className="comment-single fade-top">
      <div className="author">
        <Link href={author.profileLink} aria-label="latest games" title="view game details">
          <Image src={author.image} alt="Image" />
          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
          </svg>
        </Link>
      </div>
      <div className="author-review">
        <div className="author-meta">
          <div className="author-info">
            <h5 className="fw-6 mt-8">
              <Link href={author.profileLink}>{author.name}</Link>
            </h5>
            <p className="text-md">{date}</p>
          </div>
          <div className="reply-button">
            <button onClick={() => setReply(!reply)} className={`${reply ? "active" : ""}`} aria-label="reply">
              <i className="ti ti-share-3"></i>Reply
            </button>
          </div>
        </div>
        <div className="author-content">
          <p>{content}</p>
        </div>
        <AnimateHeight height={reply ? "auto" : 0}>
          <div className="reply-comment">
            <form action="#" method="post">
              <div className="input-group">
                <div className="input-single">
                  <textarea placeholder="Join the discussion..." required></textarea>
                </div>
                <div className="btn-wrapper">
                  <button type="submit" className="btn--secondary">
                    Submit
                  </button>
                  <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                    <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                  </svg>
                </div>
              </div>
            </form>
          </div>
        </AnimateHeight>
      </div>
    </div>
  );
};

export default CommentSingle;
