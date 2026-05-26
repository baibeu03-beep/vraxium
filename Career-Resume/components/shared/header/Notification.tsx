import avatar from "@/public/images/avatar/avatar.png";
import five from "@/public/images/avatar/five.png";
import four from "@/public/images/avatar/four.png";
import game from "@/public/images/avatar/game.png";
import six from "@/public/images/avatar/six.png";
import three from "@/public/images/avatar/three.png";
import two from "@/public/images/avatar/two.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import OutsideClickHandler from "react-outside-click-handler";

const Notification = () => {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [options, setOptions] = useState(false);
  return (
    <OutsideClickHandler onOutsideClick={() => setNotificationOpen(false)}>
      <div className="notification-dropdown nftg-modal-wrapper">
        <button onClick={() => setNotificationOpen(!notificationOpen)} className={`icon-drop notification-ic open-notification nftg-open-modal ${notificationOpen && "nftg-open-modal-active"}`} aria-label="check notifications" title="check notifications">
          <i className="ti ti-bell"></i>
        </button>
        <div className={`modal-wrapper nftg-modal-body ${notificationOpen && "nftg-modal-body-active"}`}>
          <div className="modal__header">
            <h6 className="not-cursor fw-6">Notifications</h6>
            <OutsideClickHandler onOutsideClick={() => setOptions(false)}>
              <div className="modal__settings nftg-child-wrapper">
                <button onClick={() => setOptions(!options)} aria-label="notification settings" className="nftg-child-modal">
                  <i className="ti ti-dots"></i>
                </button>
                <div className={`modal-settings__wrapper nftg-child ${options && "nftg-child-active"}`}>
                  <ul>
                    <li>
                      <Link href="/profile">
                        <i className="ti ti-check"></i>Mark All As Read
                      </Link>
                    </li>
                    <li>
                      <Link href="/profile">
                        <i className="ti ti-bell"></i>Open Notifications
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
                  <Image src={avatar} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/profile">Robert Lien</Link>
                    <span className="text-xs">01.24 am</span>
                  </p>
                  <p className="truncate text-xs mt-4">Daily reward waiting for you! Claim it now!</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={game} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/profile">Rocket League</Link>
                    <span className="text-xs">10.56 pm</span>
                  </p>
                  <p className="truncate text-xs mt-4">Congratulations! You&apos;ve earned a new achievement!</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <i className="ti ti-settings"></i>
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/profile">Settings</Link>
                    <span className="text-xs">05.30 am</span>
                  </p>
                  <p className="truncate text-xs mt-4">Terms has been updated</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={five} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/profile">Meghan W. Pemberton</Link> <span className="text-xs">2 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">Your team needs you! Join the battle now!</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={two} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/profile">Apex Legends</Link>
                    <span className="text-xs">2 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">Level up! Unlock new challenges!</p>
                </div>
              </div>
              <div className="modal-dropdown__single">
                <div className="single-avatar">
                  <Image src={six} alt="Image" />
                </div>
                <div className="single-content">
                  <p className="text-sm fw-5 single-intro">
                    <Link href="/profile">Harold Dawson</Link>
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
                    <Link href="/profile">Christie Hoyt</Link>
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
                    <Link href="/profile">Christina Curd</Link>
                    <span className="text-xs">4 days ago</span>
                  </p>
                  <p className="truncate text-xs mt-4">Stay tuned! Exciting updates coming your way</p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-dropdown__footer text-center">
            <p>
              <Link href="/profile">Check All</Link>
            </p>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default Notification;
