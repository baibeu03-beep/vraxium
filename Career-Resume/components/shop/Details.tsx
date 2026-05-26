"use client";
import avatarImage from "@/public/images/avatar/avatar.png";
import oneImage from "@/public/images/avatar/one.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Activity from "./Activity";
import DetailsSlider from "./DetailsSlider";

const Details = ({ title }: { title: string | undefined }) => {
  const [description, setDescription] = useState(true);
  const [token, setToken] = useState(true);
  return (
    <section className="nft-details pt-120 pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="back-cta mb-40">
              <Link href="/shop" title="go back" className="btn--primary">
                <i className="ti ti-chevron-left"></i> Back To Marketplace
              </Link>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-xl-6">
            <DetailsSlider />
          </div>
          <div className="col-12 col-xl-6">
            <div className="nft-details__content">
              <div className="review-wrapper mb-24">
                <div className="review-group">
                  <i className="ti ti-star-filled"></i>
                  <i className="ti ti-star-filled"></i>
                  <i className="ti ti-star-filled"></i>
                  <i className="ti ti-star-filled"></i>
                  <i className="ti ti-star-filled"></i>
                </div>
                <p className="fw-6 quaternary-text">( 3 Customers Review )</p>
              </div>
              <h4 className="fw-6">{title}</h4>
              <div className="details-info__thumb mt-30">
                <div className="details-info__single">
                  <Link href="/public-profile" className="hexagon-wrapper">
                    <Image src={avatarImage} alt="View Profile" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </Link>
                  <div className="details-info__content">
                    <p className="text-sm text-alter">Collection</p>
                    <p className="fw-6 text-xl mt-6">Plot</p>
                  </div>
                </div>
                <div className="details-info__single">
                  <Link href="/public-profile" className="hexagon-wrapper">
                    <Image src={oneImage} alt="View Profile" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </Link>
                  <div className="details-info__content">
                    <p className="text-sm text-alter">Owner</p>
                    <p className="fw-6 text-xl mt-6">0x80…A803</p>
                  </div>
                </div>
              </div>
              <div className="details-action mt-30">
                <div className="details-action__left">
                  <p className="text-xl fw-6">0.0149999999 BNB</p>
                  <p className="text-alter mt-10">1 of 1 in stock</p>
                </div>
                <div className="details-action__right">
                  <div className="btn-wrapper">
                    <a href="#" className="btn--secondary cart-btn">
                      + Add to cart
                    </a>
                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                  <div className="btn-wrapper">
                    <a href="#" className="btn--secondary">
                      Buy Now
                    </a>
                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="details-action mt-30">
                <div className="details-action__left">
                  <p className="text-xl fw-6">No offers yet</p>
                  <p className="text-alter mt-10">You can offer your price for this NFT</p>
                </div>
                <div className="details-action__right">
                  <div className="btn-wrapper">
                    <a href="#" className="btn--secondary">
                      Make Offer
                    </a>

                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap-lg mt-40">
          <div className="col-12 col-xl-6">
            <div className="details__single">
              <div className="details__single-intro">
                <p className="text-xxl fw-6">
                  <i className="ti ti-menu-2"></i> Description
                </p>
                <button onClick={() => setDescription(!description)} className={`details-btn ${!description ? "active" : ""}`} title="show info">
                  <i className="ti ti-chevron-down"></i>
                </button>
              </div>
              {description && (
                <div className="details__single-content mt-30">
                  <p className="text-alter">Every Mongens needs a place to live before they&apos;re ready to do anything. Every Mongens needs a place to live before they&apos;re ready to do anything.</p>
                </div>
              )}
            </div>
            <div className="details__single mt-30">
              <div className="details__single-intro">
                <p className="text-xxl fw-6">
                  <i className="ti ti-info-hexagon-filled"></i> Token details
                </p>
                <button onClick={() => setToken(!token)} className={`details-btn ${!token ? "active" : ""}`} title="show info">
                  <i className="ti ti-chevron-down"></i>
                </button>
              </div>
              {token && (
                <div className="details__single-content token-details mt-30">
                  <ul>
                    <li>
                      <span className="text-alter">Contract Address</span> <span className="fw-6">0xDb30AF…9Ac8</span>
                    </li>
                    <li>
                      <span className="text-alter">Token ID</span> <span className="fw-6">989994</span>
                    </li>
                    <li>
                      <span className="text-alter">Blockchain</span> <span className="fw-6">BNB Chain</span>
                    </li>
                    <li>
                      <span className="text-alter">Token Standard</span> <span className="fw-6">ERC-721</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          <Activity />
        </div>
      </div>
    </section>
  );
};

export default Details;
