"use client";

import avatarImage from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarOne from "@/public/images/avatar/one.png";
import avatarSix from "@/public/images/avatar/six.png";
import avatarThree from "@/public/images/avatar/three.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import OutsideClickHandler from "react-outside-click-handler";

const Chat = () => {
  const [child1, setChild1] = useState(false);
  const [child2, setChild2] = useState(false);
  return (
    <section className="pt-120 pb-120">
      <div className="contianer-fluid">
        <div className="row">
          <div className="col-12">
            <div className="text-center mb-55">
              <h2 className="title-lg fw-8 stroked-text transform-none title-animation mt-8">Private Chat</h2>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="chatbox">
              <div className="chatbox__inner">
                <div className="chatbox__sidebar">
                  <div className="chatbox__sidebar-wrapper">
                    <div className="chatbox__sidebar-header">
                      <div className="chatbox__header-profile">
                        <div className="hexagon-wrapper">
                          <Image src={avatarImage} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </div>
                        <p className="text-xl fw-6">David Malan</p>
                      </div>
                      <OutsideClickHandler onOutsideClick={() => setChild1(false)}>
                        <div className="modal__settings nftg-child-wrapper">
                          <button aria-label="inbox dropdown" title="inbox dropdown" className="nftg-child-modal" onClick={() => setChild1(!child1)}>
                            <i className="ti ti-dots"></i>
                          </button>
                          <div className={`modal-settings__wrapper nftg-child ${child1 ? "nftg-child-active" : ""}`}>
                            <ul>
                              <li>
                                <button type="button" aria-label="mark all as read" title="mark all as read">
                                  <i className="ti ti-check"></i>Mark All As Read
                                </button>
                              </li>
                              <li>
                                <Link href="/profile">
                                  <i className="ti ti-settings"></i>Edit Profile
                                </Link>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </OutsideClickHandler>
                    </div>
                    <div className="chatbox__sidebar-search mt-30">
                      <form action="#" method="post">
                        <div className="input-single">
                          <input type="text" name="search-friends" id="searchFriends" placeholder="Search.." required />
                          <button type="submit" aria-label="search friends" title="search friends">
                            <i className="ti ti-search"></i>
                          </button>
                        </div>
                      </form>
                    </div>
                    <button aria-label="close chatlist" title="close chatlist" className="close-chatlist d-block d-xl-none">
                      <i className="ti ti-x"></i>
                    </button>
                  </div>
                  <div className="chatbox__list">
                    <div className="chatbox__list-inner">
                      <div className="chatbox__list-single not-viewed">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarOne} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">
                              Robert Lien <span className="incoming-amount">6</span>
                            </p>
                            <span className="text-sm">5m</span>
                          </div>
                          <p className="truncate text-sm">Ok, see you later. Good Bye!</p>
                        </div>
                      </div>
                      <div className="chatbox__list-single">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarThree} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="in-active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">Rovman Doe</p>
                            <span className="text-sm">20m</span>
                          </div>
                          <p className="truncate text-sm">
                            <span className="fw-7">You:</span> I don&apos;t remember anything 😄
                          </p>
                        </div>
                      </div>
                      <div className="chatbox__list-single not-viewed">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarSix} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="in-active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">
                              Dessica Crew <span className="incoming-amount">2</span>
                            </p>
                            <span className="text-sm">2h</span>
                          </div>
                          <p className="truncate text-sm">Do You Know Him?</p>
                        </div>
                      </div>
                      <div className="chatbox__list-single">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarFour} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">Meghan Doe</p>
                            <span className="text-sm">5h</span>
                          </div>
                          <p className="truncate text-sm">
                            <span className="fw-7">You:</span>
                            Where are you?
                          </p>
                        </div>
                      </div>
                      <div className="chatbox__list-single">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarFive} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">Devon Bruce</p>
                            <span className="text-sm">1d</span>
                          </div>
                          <p className="truncate text-sm">
                            <span className="fw-7">You:</span>
                            Let&apos;s play together.
                          </p>
                        </div>
                      </div>
                      <div className="chatbox__list-single">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarSix} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">Harold Dawson</p>
                            <span className="text-sm">3d</span>
                          </div>
                          <p className="truncate text-sm">
                            <span className="fw-7">You:</span>
                            Ready for a challenge? New missions available!
                          </p>
                        </div>
                      </div>
                      <div className="chatbox__list-single">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarThree} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="in-active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">Crist Lien</p>
                            <span className="text-sm">5d</span>
                          </div>
                          <p className="truncate text-sm">New high score! Can you beat it?</p>
                        </div>
                      </div>
                      <div className="chatbox__list-single">
                        <div className="single-avatar">
                          <div className="hexagon-wrapper">
                            <Image src={avatarFour} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                            <span className="active"></span>
                          </div>
                        </div>
                        <div className="single-content">
                          <div className="single-intro">
                            <p className="text-lg fw-6">Robert Doe</p>
                            <span className="text-sm">8d</span>
                          </div>
                          <p className="truncate text-sm">Stay tuned! Exciting updates coming your way</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="chatbox__content">
                  <div className="chatbox__content-header">
                    <div className="chatbox__header-profile">
                      <button aria-label="open chatlist" title="open chatlist" className="open-chatlist d-block d-xl-none">
                        <i className="ti ti-menu-2"></i>
                      </button>
                      <div className="hexagon-wrapper">
                        <Link href="/public-profile">
                          <Image src={avatarOne} alt="View Profile" />
                        </Link>
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                        <span className="active"></span>
                      </div>
                      <p className="text-xl fw-6 d-none d-sm-block">
                        <Link href="/public-profile">Robert Lien</Link>
                      </p>
                    </div>
                    <div className="chatbox__content-actions">
                      <button aria-label="audio call" title="audio call" className="c-a">
                        <i className="ti ti-phone-call"></i>
                      </button>
                      <button aria-label="video call" title="video call" className="c-a">
                        <i className="ti ti-video"></i>
                      </button>
                      <OutsideClickHandler onOutsideClick={() => setChild2(false)}>
                        <div className="modal__settings nftg-child-wrapper">
                          <button onClick={() => setChild2(!child2)} aria-label="open dropdown" title="open dropdown" className="nftg-child-modal">
                            <i className="ti ti-dots"></i>
                          </button>
                          <div className={`modal-settings__wrapper nftg-child ${child2 ? "nftg-child-active" : ""}`}>
                            <ul>
                              <li>
                                <button type="button" aria-label="export chat" title="export chat">
                                  <i className="ti ti-trash"></i>Delete
                                </button>
                              </li>
                              <li>
                                <button type="button" aria-label="unfollow user" title="unfollow user">
                                  <i className="ti ti-user-off"></i>Unfollow
                                </button>
                              </li>
                              <li>
                                <Link href="/contact-us" aria-label="report user" title="report user">
                                  <i className="ti ti-flag"></i>Report
                                </Link>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </OutsideClickHandler>
                    </div>
                  </div>
                  <div className="chat-box">
                    <div className="chat-box-single">
                      <div className="hexagon-wrapper">
                        <Image src={avatarOne} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="wrap">
                        <p className="text-md">Hi David!</p>
                        <p className="text-md">How are you?</p>
                      </div>
                    </div>
                    <div className="chat-box-single chat-box-single-alt">
                      <div className="hexagon-wrapper">
                        <Image src={avatarImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="wrap">
                        <p className="text-md">I&apos;m fine!</p>
                        <p className="text-md">How about you?</p>
                      </div>
                    </div>
                    <div className="chat-box-single">
                      <div className="hexagon-wrapper">
                        <Image src={avatarOne} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="wrap">
                        <p className="text-md">Good.</p>
                      </div>
                      <div className="wrap">
                        <p className="text-md">I want to talk with you about the GAME.</p>
                        <p className="text-md">Do you want to join with me?</p>
                      </div>
                    </div>
                    <div className="chat-box-single chat-box-single-alt">
                      <div className="hexagon-wrapper">
                        <Image src={avatarImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="wrap">
                        <p className="text-md">Yes!</p>
                      </div>
                      <div className="wrap">
                        <p className="text-md">It&apos;ll be my pleasure!</p>
                      </div>
                      <div className="wrap">
                        <p className="text-md">I&apos;ll join with you.</p>
                        <p className="text-md">Can you tell me what type of game it is?</p>
                      </div>
                    </div>
                    <div className="chat-box-single">
                      <div className="hexagon-wrapper">
                        <Image src={avatarOne} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="wrap">
                        <p className="text-md">It is Stronghold Kingdoms</p>
                      </div>
                    </div>
                    <div className="chat-box-single chat-box-single-alt">
                      <div className="hexagon-wrapper">
                        <Image src={avatarImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="wrap">
                        <p className="text-md">Awesome!</p>
                      </div>
                      <div className="wrap">
                        <p className="text-md">Let&apos;s play together!</p>
                      </div>
                    </div>
                  </div>
                  <div className="chatbox__content-footer">
                    <button aria-label="add emoji's" title="add emoji's" className="c-a">
                      <i className="ti ti-mood-smile"></i>
                    </button>
                    <button aria-label="add file" title="add file" className="c-a">
                      <i className="ti ti-photo"></i>
                    </button>
                    <form action="#" method="post">
                      <div className="input-single">
                        <input type="text" placeholder="Type a message" required />
                        <button type="submit" aria-label="send message" title="send message">
                          <i className="ti ti-send"></i>
                        </button>
                      </div>
                    </form>
                    <button aria-label="google speaker" title="google speaker" className="c-a">
                      <i className="ti ti-microphone"></i>
                    </button>
                  </div>
                </div>
                <div className="chatbox-backdrop"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Chat;
