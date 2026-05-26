import five from "@/public/images/avatar/five.png";
import four from "@/public/images/avatar/four.png";
import one from "@/public/images/avatar/one.png";
import six from "@/public/images/avatar/six.png";
import three from "@/public/images/avatar/three.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import OutsideClickHandler from "react-outside-click-handler";

const Message = () => {
  const [messageOpen, setMessageOpen] = useState(false);
  const [options, setOptions] = useState(false);
  return (
    <OutsideClickHandler onOutsideClick={() => setMessageOpen(false)}>
      <div className="message-dropdown nftg-modal-wrapper">
        <button onClick={() => setMessageOpen(!messageOpen)} className={`icon-drop open-message nftg-open-modal ${messageOpen && "nftg-open-modal-active"}`} aria-label="check inbox" title="check inbox">
          <i className="ti ti-message"></i>
        </button>
        <div className={`modal-wrapper nftg-modal-body ${messageOpen && "nftg-modal-body-active"}`}>
          <div className="modal__header">
            <h6 className="not-cursor fw-6">Messages</h6>
            <OutsideClickHandler onOutsideClick={() => setOptions(false)}>
              <div className="modal__settings nftg-child-wrapper">
                <button onClick={() => setOptions(!options)} aria-label="message settings" className="nftg-child-modal">
                  <i className="ti ti-dots"></i>
                </button>
                <div className={`modal-settings__wrapper nftg-child ${options && "nftg-child-active"}`}>
                  <ul>
                    <li>
                      <Link href="/chat">
                        <i className="ti ti-check"></i>Mark All As Read
                      </Link>
                    </li>
                    <li>
                      <Link href="/chat">
                        <i className="ti ti-message"></i>Open Inbox
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </OutsideClickHandler>
          </div>
          <hr />
          <div className="modal-dropdown__body">
            <div className="modal-dropdown__inner">
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={one} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Robert Lien</Link>
                    <span className="text-xs">01.24 am</span>
                  </p>
                  <p className="truncate text-xs mt-4">Ok, see you later. Good Bye!</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={three} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Rocket League</Link>
                    <span className="text-xs">10.56 pm</span>
                  </p>
                  <p className="truncate text-xs mt-4">I don&apos;t remember anything 😄</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={six} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Jessica Crew</Link>
                    <span className="text-xs">05.30 am</span>
                  </p>
                  <p className="truncate text-xs mt-4">Do You Know Him?</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={four} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Meghan W. Pemberton</Link> <span className="text-xs">2 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">Where are you?</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={five} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Devon Bruce</Link>
                    <span className="text-xs">2 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">Let&apos;s play together.</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={six} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Harold Dawson</Link>
                    <span className="text-xs">3 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">Ready for a challenge? New missions available!</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={three} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Christie Hoyt</Link>
                    <span className="text-xs">3 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">New high score! Can you beat it?</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={four} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/chat">Christina Curd</Link>
                    <span className="text-xs">4 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">Stay tuned! Exciting updates coming your way</p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-dropdown__footer text-center">
            <p>
              <Link href="/chat">View All</Link>
            </p>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default Message;
