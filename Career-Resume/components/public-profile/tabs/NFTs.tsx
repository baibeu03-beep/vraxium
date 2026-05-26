"use client";
import NiceSelectComponent from "@/components/shared/NiceSelect";
import avatarImage from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarOne from "@/public/images/avatar/one.png";
import avatarSix from "@/public/images/avatar/six.png";
import trendingFive from "@/public/images/games/trending/five.png";
import trendingFour from "@/public/images/games/trending/four.png";
import trendingOne from "@/public/images/games/trending/one.png";
import trendingSix from "@/public/images/games/trending/six.png";
import trendingThree from "@/public/images/games/trending/three.png";
import trendingTwo from "@/public/images/games/trending/two.png";
import Image from "next/image";
import Link from "next/link";
import Tilt from "react-parallax-tilt";

const ProfileNFT = () => {
  const nftItems = [
    {
      id: 7,
      image: trendingFour,
      name: "Quantum Quilt",
      number: "#654",
      creator: {
        name: "Zoe Zen",
        avatar: avatarSix,
      },
      price: "3.7",
      currency: "ETH",
      likes: 20,
    },
    {
      id: 3,
      image: trendingOne,
      name: "Ethereal Echo",
      number: "#789",
      creator: {
        name: "Jack Sparrow",
        avatar: avatarFive,
      },
      price: "1.8",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 11,
      image: trendingSix,
      name: "Pixel Paradise",
      number: "#321",
      creator: {
        name: "Court Henry",
        avatar: avatarOne,
      },
      price: "4.015",
      currency: "ETH",
      likes: 31,
    },
    {
      id: 1,
      image: trendingTwo,
      name: "Neon Nexus",
      number: "#123",
      creator: {
        name: "David Malan",
        avatar: avatarImage,
      },
      price: "2.9",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 9,
      image: trendingFive,
      name: "Bit Blossom",
      number: "#987",
      creator: {
        name: "Wade Warren",
        avatar: avatarSix,
      },
      price: "1.015",
      currency: "ETH",
      likes: 4,
    },
    {
      id: 5,
      image: trendingThree,
      name: "Cosmic Canvas",
      number: "#143",
      creator: {
        name: "Ann Black",
        avatar: avatarFive,
      },
      price: "3.015",
      currency: "ETH",
      likes: 9,
    },
    {
      id: 12,
      image: trendingOne,
      name: "Techno Tots",
      number: "#876",
      creator: {
        name: "Est Howard",
        avatar: avatarOne,
      },
      price: "2.015",
      currency: "ETH",
      likes: 25,
    },
    {
      id: 2,
      image: trendingFour,
      name: "Virtual Vortex",
      number: "#322",
      creator: {
        name: "Ar Mccoy",
        avatar: avatarFour,
      },
      price: "3.3",
      currency: "ETH",
      likes: 18,
    },
    {
      id: 8,
      image: trendingSix,
      name: "Crypto Cutie",
      number: "#456",
      creator: {
        name: "Finn Fable",
        avatar: avatarFive,
      },
      price: "2.5",
      currency: "ETH",
      likes: 15,
    },
    {
      id: 4,
      image: trendingTwo,
      name: "Digital Dolly",
      number: "#127",
      creator: {
        name: "Emma Stone",
        avatar: avatarFive,
      },
      price: "4.2",
      currency: "ETH",
      likes: 27,
    },
    {
      id: 6,
      image: trendingFive,
      name: "Crypto Collectibles",
      number: "#543",
      creator: {
        name: "Max Power",
        avatar: avatarOne,
      },
      price: "5.015",
      currency: "ETH",
      likes: 22,
    },
    {
      id: 10,
      image: trendingThree,
      name: "Byte Blossom",
      number: "#654",
      creator: {
        name: "Lila Rose",
        avatar: avatarSix,
      },
      price: "1.015",
      currency: "ETH",
      likes: 33,
    },
  ];

  return (
    <div className="profile-tab-single" id="profileNft">
      <div className="profile-tab-filter">
        <div className="profile-tab-filter__inner">
          <div className="profile-tab-filter__single">
            <h6>
              <i className="ti ti-filter"></i> Filter
            </h6>
          </div>
          <div className="profile-tab-group">
            <form action="#" method="post" autoComplete="off">
              <div className="search-wrap">
                <input type="search" name="profile-field-nft" id="profileFieldnft" placeholder="Search" required />
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                  <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vector-effect="non-scaling-stroke" />
                </svg>
                <button type="submit" aria-label="search nft" title="search nft">
                  <i className="ti ti-search"></i>
                </button>
              </div>
            </form>
            <div className="game-filter">
              <div className="select-shape btn-wrapper">
                <NiceSelectComponent
                  options={[
                    { value: "recent", text: "Recently Listed" },
                    { value: "newest", text: "Newest" },
                    { value: "oldest", text: "Oldest" },
                  ]}
                  onChange={(item) => {
                    // Handle the change event
                    console.log("Selected:", item);
                  }}
                />
                <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                  <path d="M0 1  L100 1  L100 75 L85 101 L0 101 Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="trending">
        <div className="trending__wrapper mt-60 ">
          {nftItems.map((item) => (
            <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} key={item.id} className="trending__single fade-top van-tilt">
              <div className="thumb ">
                <Link href="/shop/1">
                  <Image src={item.image} alt="Image" />
                </Link>
              </div>
              <div className="content-wrapper">
                <div className="info">
                  <p className="text-sm fw-6">
                    <Link href="/shop/1">{item.name}</Link>
                    <span>{item.number}</span>
                  </p>
                </div>
                <div className="trending__single-footer">
                  <div className="author">
                    <div className="author-meta">
                      <Link href="/public-profile" aria-label="view profile" title="view profile">
                        <span className="hexagon-wrapper">
                          <Image src={item.creator.avatar} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </span>
                        <span className="text-sm fw-6">{item.creator.name}</span>
                      </Link>
                    </div>
                    <div className="author-title">
                      <p className="text-uppercase text-xs fw-6">CREATOR</p>
                    </div>
                  </div>
                  <div className="price-footer">
                    <div className="price-inner">
                      <p className="price text-sm fw-6">
                        {item.price} <span className="currency">{item.currency}</span>
                      </p>
                      <Link href="/shop/1" className="btn--primary text-sm">
                        Bid
                        <i className="ti ti-arrow-narrow-right"></i>
                      </Link>
                      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                        <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vector-effect="non-scaling-stroke"></path>
                      </svg>
                    </div>
                    <div className="review">
                      <Link href="/shop/1" className="text-sm fw-6">
                        <i className="ti ti-heart-filled"></i>
                        {item.likes}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Tilt>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileNFT;
