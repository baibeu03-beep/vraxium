"use client";
import avatarImage from "@/public/images/avatar/avatar.png";
import blogFiveImage from "@/public/images/blog/five.png";
import blogOneImage from "@/public/images/blog/one.png";
import blogSevenImage from "@/public/images/blog/seven.png";
import blogSixImage from "@/public/images/blog/six.png";
import blogThreeImage from "@/public/images/blog/three.png";
import blogTwoImage from "@/public/images/blog/two.png";
import streamerFourImage from "@/public/images/streamer/t-four.png";
import streamerThreeImage from "@/public/images/streamer/t-three.png";
import streamerTwoImage from "@/public/images/streamer/t-two.png";
import Image from "next/image";
import Link from "next/link";
import Social from "../shared/SocialTwo";
import CommentSingle from "./CommentBox";
const comments = [
  {
    id: 1,
    author: {
      name: "Wade Warren",
      image: streamerTwoImage,
      profileLink: "/public-profile",
    },
    date: "October 07,2023",
    content: "Gaming has cultivated vibrant communities and the rise of esports has brought competitive gaming to the forefront. its rapid growth, and the professional gaming scene and the rise of esports has.",
  },
  {
    id: 2,
    author: {
      name: "Albert Flores",
      image: streamerThreeImage,
      profileLink: "/public-profile",
    },
    date: "October 07,2023",
    content: "Gaming has cultivated vibrant communities and the rise of esports has brought competitive gaming to the forefront. its rapid growth, and the professional gaming scene and the rise of esports has.",
  },
  {
    id: 3,
    author: {
      name: "Guy Hawkins",
      image: streamerFourImage,
      profileLink: "/public-profile",
    },
    date: "October 07,2023",
    content: "Gaming has cultivated vibrant communities and the rise of esports has brought competitive gaming to the forefront. its rapid growth, and the professional gaming scene and the rise of esports has.",
  },
];
const BlogDetails = () => {
  return (
    <section className="pt-120 pb-120 blog-area fade-wrapper">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12 col-xl-8">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Blog Details</h2>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-xl-8">
            <div className="blog-area__content">
              <div className="blog-details">
                <div className="details__poster">
                  <div className="thumb fade-top">
                    <Image src={blogOneImage} alt="Image" />
                  </div>
                </div>
                <div className="details__content">
                  <div className="item-meta">
                    <p className="text-md">
                      <i className="ti ti-calendar-stats"></i>02 Apr 2023
                    </p>
                    <p className="text-md">
                      <Link href="/blog/1">
                        <i className="ti ti-message"></i> Comments (03)
                      </Link>
                    </p>
                  </div>
                  <h3 className="fw-6">Beyond the Console Exploring Gaming Frontiers</h3>
                  <p>
                    Contrary to common misconceptions, gaming offers numerous to benefits beyond mere entertainment. Studies have shown that gaming can enhance cognitive improve problem-solving abilities, how and foster strategic thinking. Additionally, online multiplayer games provide opportunities
                    for social interaction, teamwork, and cooperation, promoting valuable skills in communication gaming and how it can be a source of personal growth and development numerous to benefits beyond mere entertainment.
                  </p>
                  <p>
                    From action-packed shooters to immersive role-playing games (RPGs) and strategy-based simulations, the gaming industry boasts an array of genres that cater to every player&apos;s preferences. Whether you prefer intense battles, mind-bending puzzles, or epic quests, there&apos;s a
                    game genre to suit every taste mind-bending puzzles, or epic quests.
                  </p>
                  <div className="quote-wrapper fade-top">
                    <blockquote>
                      <q className="text-xxl fw-6">Dive into the fascinating world of game development. Gain insights into the creative process, industry trends, and exclusive interviews with game developers. Explore how your favorite games come to life behind the scenes.</q>
                    </blockquote>
                    <div className="quote-footer">
                      <h4>
                        {" "}
                        <span></span>Thompson Scot
                      </h4>
                      <i className="ti ti-quote"></i>
                    </div>
                  </div>
                  <p>
                    From action-packed shooters to immersive role-playing games (RPGs) and strategy-based simulations, the gaming industry boasts an array of genres that cater to every player&apos;s preferences. Whether you prefer intense battles, mind-bending puzzles, or epic quests, there&apos;s a
                    game genre to suit every taste mind-bending puzzles, or epic quests Whether you prefer intense battles.
                  </p>
                  <div className="group-wrapper">
                    <h3>NFT Games Android No Investment</h3>
                    <div className="img-group">
                      <div className="thumb fade-top">
                        <Image src={blogTwoImage} alt="Image" />
                      </div>
                      <div className="thumb fade-top">
                        <Image src={blogThreeImage} alt="Image" />
                      </div>
                    </div>
                  </div>
                  <p>
                    From action-packed shooters to immersive role-playing games (RPGs) and strategy-based simulations, the gaming industry boasts an array of genres that cater to every player&apos;s preferences. Whether you prefer intense battles, mind-bending puzzles, or epic quests, there&apos;s a
                    game genre to suit every taste mind-bending puzzles, or epic quests Whether you prefer intense battles.
                  </p>
                  <p>
                    From action-packed shooters to immersive role-playing games (RPGs) and strategy-based simulations, the gaming industry boasts an array of genres that cater to every player&apos;s preferences. Whether you prefer intense battles, mind-bending puzzles, or epic quests, there&apos;s a
                    game genre to suit every taste mind-bending puzzles, or epic quests Whether you prefer intense battles.
                  </p>
                  <div className="blog-divider"></div>
                  <div className="details-footer">
                    <div className="details-tag">
                      <div className="tag-header">
                        <h5>Tags :</h5>
                      </div>
                      <div className="tag-wrapper">
                        <a href="#">E-Sports</a>
                        <a href="#">Fantasy</a>
                        <a href="#">Tournaments</a>
                      </div>
                    </div>
                    <div className="details-tag">
                      <div className="tag-header">
                        <h5>Share :</h5>
                      </div>
                      <Social />
                    </div>
                  </div>
                </div>
              </div>
              <div className="blog-comment pt-120">
                <div className="comment-header mb-40">
                  <h4 className="mt-8 fw-6">03 Comments</h4>
                </div>
                {comments.map((comment) => (
                  <CommentSingle key={comment.id} {...comment} />
                ))}
                <div className="comment__form mt-120">
                  <div className="comment-header mb-40">
                    <h4 className="mt-8 fw-6">Leave A Comment</h4>
                  </div>
                  <form action="#" method="post">
                    <div className="form-group">
                      <div className="input-single">
                        <div className="ic-group">
                          <input type="text" name="comment-name" id="commentName" placeholder="Enter Your Name" required />
                          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                            <path d="M0 0  L100 0  L100 79 L96 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                          </svg>
                        </div>
                      </div>
                      <div className="input-single">
                        <div className="ic-group">
                          <input type="email" name="comment-email" id="commentEmail" placeholder="Enter Your Email" required />
                          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                            <path d="M0 0  L100 0  L100 79 L96 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="input-single">
                      <div className="ic-group">
                        <textarea name="comment-message" id="commentMessage" cols={30} rows={10} placeholder="Type Your Comments..."></textarea>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                          <path d="M0 0  L100 0  L100 79 L96 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                    <div className="cta mt-40">
                      <div className="btn-wrapper">
                        <button type="submit" className="btn--secondary">
                          Submit Comment
                        </button>
                        <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                          <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                        </svg>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="blog-area__sidebar">
              <div className="sidebar__widget fade-top">
                <div className="author-meta-wrapper">
                  <div className="author-meta">
                    <Link href="/public-profile" aria-label="view profile" title="view profile">
                      <span className="hexagon-wrapper">
                        <Image src={avatarImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </span>
                    </Link>
                    <p className="text-xxl fw-6">
                      <Link href="/public-profile">Wade Warren</Link>
                    </p>
                  </div>
                  <p className="text-md">Crypto Advisor</p>
                </div>
                <div className="content">
                  <p className="text-md">Welcome to the exciting realm of online gaming, virtual adventures await at every turn. Welcome to the exciting realm of online gaming, virtual adventures await at every turn.</p>
                  <Social />
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
                        <Image src={blogFiveImage} alt="Image" />
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
                        <Image src={blogSixImage} alt="Image" />
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
                        <Image src={blogSevenImage} alt="Image" />
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

export default BlogDetails;
