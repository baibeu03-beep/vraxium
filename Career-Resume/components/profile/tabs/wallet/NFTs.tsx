"use client";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import React from "react";
import Tilt from "react-parallax-tilt";

// Import images
import avatarDefault from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarOne from "@/public/images/avatar/one.png";
import avatarSix from "@/public/images/avatar/six.png";
import byteBlossom from "@/public/images/games/trending/five.png";
import cryptoCollectibles from "@/public/images/games/trending/four.png";
import bitBlossom from "@/public/images/games/trending/one.png";
import digitalDolly from "@/public/images/games/trending/six.png";
import cryptoCutie from "@/public/images/games/trending/three.png";
import technoTots from "@/public/images/games/trending/two.png";

interface NFT {
  id: number;
  name: string;
  number: string;
  image: StaticImageData | string;
  creator: {
    name: string;
    avatar: StaticImageData | string;
  };
  price: string;
  currency: string;
  likes: number;
}

const nftData: NFT[] = [
  {
    id: 1,
    name: "Bit Blossom",
    number: "#123",
    image: bitBlossom,
    creator: {
      name: "David Malan",
      avatar: avatarDefault,
    },
    price: "1.015",
    currency: "ETH",
    likes: 11,
  },
  {
    id: 2,
    name: "Techno Tots",
    number: "#322",
    image: technoTots,
    creator: {
      name: "Est Howard",
      avatar: avatarOne,
    },
    price: "2.015",
    currency: "ETH",
    likes: 18,
  },
  {
    id: 3,
    name: "Crypto Cutie",
    number: "#326",
    image: cryptoCutie,
    creator: {
      name: "Ann Black",
      avatar: avatarFive,
    },
    price: "3.015",
    currency: "ETH",
    likes: 11,
  },
  {
    id: 4,
    name: "Crypto Collectibles",
    number: "#127",
    image: cryptoCollectibles,
    creator: {
      name: "Ar Mccoy",
      avatar: avatarFour,
    },
    price: "1.015",
    currency: "ETH",
    likes: 27,
  },
  {
    id: 5,
    name: "Byte Blossom",
    number: "#143",
    image: byteBlossom,
    creator: {
      name: "Wade Warren",
      avatar: avatarSix,
    },
    price: "5.015",
    currency: "ETH",
    likes: 4,
  },
  {
    id: 6,
    name: "Digital Dolly",
    number: "#543",
    image: digitalDolly,
    creator: {
      name: "Court Henry",
      avatar: avatarOne,
    },
    price: "4.015",
    currency: "ETH",
    likes: 31,
  },
];

const NFTCard: React.FC<{ nft: NFT }> = ({ nft }) => (
  <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} className="trending__single van-tilt">
    <div className="thumb">
      <Link href="/shop/1">
        <Image src={nft.image} alt={nft.name} width={500} height={500} />
      </Link>
    </div>
    <div className="content-wrapper">
      <div className="info">
        <p className="text-sm fw-6">
          <Link href="/shop/1">{nft.name}</Link>
          <span>{nft.number}</span>
        </p>
      </div>
      <div className="trending__single-footer">
        <div className="author">
          <div className="author-meta">
            <Link href="/public-profile" aria-label="view profile" title="view profile">
              <span className="hexagon-wrapper">
                <Image src={nft.creator.avatar} alt="View Profile" width={100} height={100} />
                <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                  <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                </svg>
              </span>
              <span className="text-sm fw-6">{nft.creator.name}</span>
            </Link>
          </div>
          <div className="author-title">
            <p className="text-uppercase text-xs fw-6">CREATOR</p>
          </div>
        </div>
        <div className="price-footer">
          <div className="price-inner">
            <p className="price text-sm fw-6">
              {nft.price}
              <span className="currency">{nft.currency}</span>
            </p>
            <Link href="/shop/1" className="btn--primary text-sm">
              Bid
              <i className="ti ti-arrow-narrow-right"></i>
            </Link>
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
              <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
            </svg>
          </div>
          <div className="review">
            <Link href="/shop/1" className="text-sm fw-6">
              <i className="ti ti-heart-filled"></i>
              {nft.likes}
            </Link>
          </div>
        </div>
      </div>
    </div>
  </Tilt>
);

const NFTs: React.FC = () => {
  return (
    <div className="private-content__single trending" id="privateNft">
      <div className="trending__wrapper">
        {nftData.map((nft) => (
          <NFTCard key={nft.id} nft={nft} />
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
            <Link href="/profile">1</Link>
          </li>
          <li>
            <Link href="/profile" className="active">
              2
            </Link>
          </li>
          <li>
            <Link href="/profile">3</Link>
          </li>
          <li>
            <button>
              <i className="ti ti-chevrons-right"></i>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default NFTs;
