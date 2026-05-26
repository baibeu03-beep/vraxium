"use client";
import footerImg from "@/public/images/0/footer-img.png";
import footerLogo from "@/public/images/0/footer-logo.png";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Social from "../shared/Social";

gsap.registerPlugin(ScrollTrigger);
const Footer = () => {
  const path = usePathname();
  useEffect(() => {
    const fadeItems = document.querySelectorAll<HTMLElement>(".fade-top");

    fadeItems.forEach((element, index) => {
      const delay = index * 0.2;

      gsap.set(element, {
        opacity: 0,
        y: 160,
      });

      ScrollTrigger.create({
        trigger: element,
        start: "top 100%",
        end: "bottom 20%",
        scrub: 0.5,
        onEnter: () => {
          gsap.to(element, {
            opacity: 1,
            y: 0,
            duration: 1,
            delay: delay,
          });
        },
        once: true,
      });
    });
  }, [path]);
  return (
    <footer className="footer fade-wrapper">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="footer__inner">
              <div className="row vertical-column-gap-lg">
                <div className="col-12 col-lg-4">
                  <div className="footer__widget fade-top">
                    <div className="footer__widget-header">
                      <h4 className="fw-6 title-animation mt-8">Quick Link</h4>
                    </div>
                    <div className="footer__widget-content mt-30">
                      <div className="row">
                        <div className="col-12 col-xl-6">
                          <ul>
                            <li>
                              <span>About Us</span>
                            </li>
                            <li>
                              <span>Talent Marketplace</span>
                            </li>
                            <li>
                              <span>Blog</span>
                            </li>
                          </ul>
                        </div>
                        <div className="col-12 col-xl-6">
                          <ul>
                            <li>
                              <span>Tournaments</span>
                            </li>
                            <li>
                              <span>Games</span>
                            </li>
                            <li>
                              <span>Leaderboard</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="footer__widget-newsletter mt-30">
                      <div className="footer__newsletter-header">
                        <h5 className="fw-6 mt-8">Subscribe To Newsletter</h5>
                      </div>
                      <div className="footer__newsletter-wrapper">
                        <form action="#" method="post" autoComplete="off">
                          <div className="newsletter-form">
                            <div className="newsletter-form-group">
                              <input type="email" name="subscribe-newsletter" id="subscribeNewsletter" placeholder="Enter Your Email" required />
                              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                              </svg>
                            </div>
                            <button type="submit" aria-label="Subscribe Our Newsletter" title="Subscribe Our Newsletter" className="btn--primary">
                              <i className="ti ti-send"></i>
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-lg-4">
                  <div className="footer__widget footer__widget--alt mt-8 fade-top">
                    <div className="footer__widget-text">
                      <p className="text-center">Dive into the competent workforce infrastructure. Challenge the world our ancestors have devoted for us.</p>
                    </div>
                    <div className="footer__widget-logo  text-center mt-35">
                      <span className="not-cursor">
                        <Image src={footerLogo} alt="Logo" />
                      </span>
                    </div>
                    <div className=" footer__widget-text footer__widget-text--alt mt-35">
                      <p className="text-center">Inspire your ambition, not frustration.</p>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-lg-4">
                  <div className="footer__widget footer__widget-contact fade-top">
                    <div className="footer__widget-header">
                      <h4 className="fw-6 title-animation mt-8">Contact Us</h4>
                    </div>
                    <div className="footer__widget-content mt-24">
                      <div className="row">
                        <div className="col-12 col-xl-6">
                          <div>
                            <p>
                              <span>29274 Cliffside Dr, Malibu, CA 90265</span>
                            </p>
                          </div>
                        </div>
                        <div className="col-12 col-xl-6">
                          <ul>
                            <li>
                              <span>(629) 555-0129</span>
                            </li>
                            <li>
                              <span>example@gmail.com</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="footer__widget-social mt-30">
                      <div className="footer__social-header">
                        <h5 className="fw-6 mt-8">Follow Us :</h5>
                      </div>
                      <div className="footer__social-wrapper">
                        <Social />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-thumb fade-left">
          <Image src={footerImg} alt="Footer Image" width={230} height={184} />
        </div>
        <div className="row">
          <div className="col-12">
            <div className="footer__copyright">
              <div className="row align-items-center vertical-column-gap">
                <div className="col-12 col-lg-6">
                  <div className="footer__copyright-content text-center text-lg-start">
                    <p>
                      Copyright &copy;
                      <span>NFTG</span>. <span className="divider"></span> Designed By <span>PIXELAXIS</span>
                    </p>
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="footer__copyright-links">
                    <ul className="justify-content-center justify-content-lg-end">
                      <li>
                        <span>Privacy Policy</span>
                      </li>
                      <li>
                        <span>Terms & Conditions</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
