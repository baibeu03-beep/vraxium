"use client";
import { blogPosts } from "@/public/data/blogs";
import avatarImage from "@/public/images/avatar/avatar.png";
import blogFive from "@/public/images/blog/five.png";
import blogSeven from "@/public/images/blog/seven.png";
import blogSix from "@/public/images/blog/six.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

gsap.registerPlugin(ScrollTrigger);

const Blog = () => {
  const socialLinks = [
    { href: "https://www.facebook.com/", icon: "ti-brand-facebook", label: "follow us on facebook", title: "facebook" },
    { href: "https://www.twitter.com/", icon: "ti-brand-twitter", label: "follow us on twitter", title: "twitter" },
    { href: "https://www.twitch.tv/", icon: "ti-brand-twitch", label: "watch us on twitch", title: "Twitch" },
    { href: "https://www.instagram.com/", icon: "ti-brand-instagram", label: "follow us on instagram", title: "instagram" },
  ];

  const [activeSocial, setActiveSocial] = useState("twitter");

  useGSAP(() => {
    const elements = document.querySelectorAll(".appear-down");
    elements.forEach((element) => {
      gsap.fromTo(
        element,
        {
          scale: 0.8,
          opacity: 0,
        },
        {
          scale: 1,
          opacity: 1,
          duration: 1,
          stagger: 0.2,
          scrollTrigger: {
            trigger: element,
            scrub: 1,
            start: "top bottom",
            end: "top center",
            markers: false,
          },
        },
      );
    });
  });

  return (
    <section className="pt-120 pb-120 blog-area fade-wrapper">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12 col-xl-8">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Blog Standard</h2>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-xl-8">
            <div className="blog-area__content">
              <div className="blog-item__wrapper ">
                {blogPosts.map((post) => (
                  <div key={post.id}>
                    <div className="blog__single appear-down">
                      <div className="thumb">
                        <Link href={`/blog/${post.id}`}>
                          <Image src={post.image} alt="Blog Image" />
                        </Link>
                      </div>
                      <div className="content">
                        <div className="item-meta">
                          <p className="text-md">
                            <i className="ti ti-calendar-stats"></i>
                            {post.date}
                          </p>
                          <p className="text-md">
                            <Link href={`/blog/${post.id}`}>
                              <i className="ti ti-message"></i> Comments ({post.comments})
                            </Link>
                          </p>
                        </div>
                        <h3>
                          <Link href={`/blog/${post.id}`}>{post.title}</Link>
                        </h3>
                        <p>{post.content}</p>
                        <div className="cta">
                          <div className="btn-wrapper">
                            <Link href={`/blog/${post.id}`} className="btn--secondary">
                              Read More
                            </Link>
                            <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                              <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    {post.id !== blogPosts.length && <div className="blog-divider"></div>}
                  </div>
                ))}
              </div>
              <div className="pagination-wrapper">
                <ul className="pagination">
                  <li>
                    <button>
                      <i className="ti ti-chevrons-left"></i>
                    </button>
                  </li>
                  <li>
                    <Link href="/blog/1-view">1</Link>
                  </li>
                  <li>
                    <Link href="/blog/1-view" className="active">
                      2
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog/1-view">3</Link>
                  </li>
                  <li>
                    <button>
                      <i className="ti ti-chevrons-right"></i>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="blog-area__sidebar">
              <div className="sidebar__widget fade-top">
                <div className="author-meta-wrapper">
                  <div className="author-meta">
                    <Link href="/public/1" aria-label="view profile" title="view profile">
                      <span className="hexagon-wrapper">
                        <Image src={avatarImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </span>
                    </Link>
                    <p className="text-xxl fw-6">
                      <Link href="/public/1">Wade Warren</Link>
                    </p>
                  </div>
                  <p className="text-md">Crypto Advisor</p>
                </div>
                <div className="content">
                  <p className="text-md">Welcome to the exciting realm of online gaming, virtual adventures await at every turn. Welcome to the exciting realm of online gaming, virtual adventures await at every turn.</p>
                  <ul className="social">
                    {socialLinks.map((social, index) => (
                      <li key={index}>
                        <a href={social.href} target="_blank" aria-label={social.label} title={social.title} className={`social-btn ${activeSocial === social.title ? "social-btn-active" : ""}`} onMouseEnter={() => setActiveSocial(social.title)}>
                          <i className={`ti ${social.icon}`}></i>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="sidebar__widget fade-top">
                <div className="sidebar__widget-header">
                  <h5 className="fw-6">Search Here</h5>
                </div>
                <div className="sidebar__widget-search">
                  <form action="#" method="post" autoComplete="off">
                    <div className="search-wrap">
                      <input type="search" name="search-field-post" id="searchFieldPost" placeholder="Search" required />
                      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                        <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <button type="submit" aria-label="search post" title="search post">
                        <i className="ti ti-search"></i>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              <div className="sidebar__widget fade-top">
                <div className="sidebar__widget-header">
                  <h5 className="fw-6">Recent Posts</h5>
                </div>
                <div className="recent-item-wrapper">
                  <div className="recent-item-single">
                    <div className="recent-thumb">
                      <Link href="/blog/1">
                        <Image src={blogFive} alt="Recent Blog Image" />
                      </Link>
                    </div>
                    <div className="recent-content">
                      <p className="text-md">
                        <i className="ti ti-calendar-stats"></i>02 Apr 2023
                      </p>
                      <h6 className="fw-6">
                        <Link href="/blog/1">Game Craft Crafting the Ultimate</Link>
                      </h6>
                    </div>
                  </div>
                  <div className="divide"></div>
                  <div className="recent-item-single">
                    <div className="recent-thumb">
                      <Link href="/blog/1">
                        <Image src={blogSix} alt="Recent Blog Image" />
                      </Link>
                    </div>
                    <div className="recent-content">
                      <p className="text-md">
                        <i className="ti ti-calendar-stats"></i>02 Apr 2023
                      </p>
                      <h6 className="fw-6">
                        <Link href="/blog/1">Play to earn crypto games place</Link>
                      </h6>
                    </div>
                  </div>
                  <div className="divide"></div>
                  <div className="recent-item-single">
                    <div className="recent-thumb">
                      <Link href="/blog/1">
                        <Image src={blogSeven} alt="Recent Blog Image" />
                      </Link>
                    </div>
                    <div className="recent-content">
                      <p className="text-md">
                        <i className="ti ti-calendar-stats"></i>02 Apr 2023
                      </p>
                      <h6 className="fw-6">
                        <Link href="/blog/1">Game Craft Crafting the Ultimate</Link>
                      </h6>
                    </div>
                  </div>
                </div>
              </div>
              <div className="sidebar__widget fade-top">
                <div className="sidebar__widget-header">
                  <h5 className="fw-6">Categories</h5>
                </div>
                <div className="sidebar__categories">
                  <ul>
                    <li>
                      <a href="#">
                        <span>Gaming</span>
                        <span>(12)</span>
                      </a>
                    </li>
                    <li>
                      <a href="#">
                        <span>Electronic</span>
                        <span>(12)</span>
                      </a>
                    </li>
                    <li>
                      <a href="#">
                        <span>Online</span>
                        <span>(12)</span>
                      </a>
                    </li>
                    <li>
                      <a href="#">
                        <span>Tournaments</span>
                        <span>(12)</span>
                      </a>
                    </li>
                    <li>
                      <a href="#">
                        <span>Controller</span>
                        <span>(12)</span>
                      </a>
                    </li>
                    <li>
                      <a href="#">
                        <span>Live</span>
                        <span>(12)</span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="sidebar__widget fade-top">
                <div className="sidebar__widget-header">
                  <h5 className="fw-6">Tags</h5>
                </div>
                <div className="sidebar__tags">
                  <a href="#" className="btn--primary">
                    E-Sports
                  </a>
                  <a href="#" className="btn--primary">
                    Fantasy
                  </a>
                  <a href="#" className="btn--primary">
                    Tournaments
                  </a>
                  <a href="#" className="btn--primary">
                    Live
                  </a>
                  <a href="#" className="btn--primary">
                    Streamers
                  </a>
                  <a href="#" className="btn--primary">
                    Matches
                  </a>
                  <a href="#" className="btn--primary">
                    Landing
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Blog;
