"use client";
import communityThumb from "@/public/images/community-thumb.png";
import Image from "next/image";
import Tilt from "react-parallax-tilt";

const Community = () => {
  return (
    <section className="community mt-120 pt-120 pb-120 fade-wrapper">
      <div className="container">
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-xxl-7">
            <div className="community__content mb-60">
              <h2 className="fw-6 mt-8">A New Home For Your Gaming Community</h2>
            </div>
            <div className="row vertical-column-gap-md">
              <div className="col-12 col-md-6">
                <div className="community__content-single fade-top">
                  <div className="thumb">
                    <i className="ti ti-users"></i>
                  </div>
                  <div className="content mt-24">
                    <h5 className="fw-6">Grow your community</h5>
                    <p className="text-alter mt-12">Grow your community by hosting both casual and competitive tournaments for free.</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="community__content-single fade-top">
                  <div className="thumb">
                    <i className="ti ti-trophy"></i>
                  </div>
                  <div className="content mt-24">
                    <h5 className="fw-6">Community competitions</h5>
                    <p className="text-alter mt-12">Enable community competitions for fun or to find out who&apos;s the best.</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="community__content-single fade-top">
                  <div className="thumb">
                    <i className="ti ti-messages"></i>
                  </div>
                  <div className="content mt-24">
                    <h5 className="fw-6">Communicate</h5>
                    <p className="text-alter mt-12">Share updates to your members in the feed and let them communicate with each other in the shared chat.</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="community__content-single fade-top">
                  <div className="thumb">
                    <i className="ti ti-spacing-vertical"></i>
                  </div>
                  <div className="content mt-24">
                    <h5 className="fw-6">Get A free space</h5>
                    <p className="text-alter mt-12">Claim Your Free Space: Unlock a World of Possibilities without Cost. Join Now for Limitless Exploration</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xxl-5">
            <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} className="community__thumb van-tilt fade-top">
              <Image src={communityThumb} alt="Image" />
            </Tilt>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Community;
