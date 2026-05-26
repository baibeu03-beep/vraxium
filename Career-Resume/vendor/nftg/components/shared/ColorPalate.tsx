"use client";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

type Props = {
  colorPalete: boolean;
  setColorPalete: Dispatch<SetStateAction<boolean>>;
};
const ColorPalate = ({ colorPalete, setColorPalete }: Props) => {
  const [sidebar, setSidebar] = useState(true);
  const [CustomCursor, setCustomCursor] = useState(true);

  useEffect(() => {
    document.querySelector(".nftg-app")?.classList.toggle("sidebar-remove", !sidebar);
  });
  useEffect(() => {
    if (CustomCursor) {
      document.querySelector(".nftg-app")?.classList.add("a-cursor");
    } else {
      document.querySelector(".nftg-app")?.classList.remove("a-cursor");
    }
  }, [CustomCursor]);
  return (
    <div className="color-palate">
      <div className="color-icon" style={{ right: colorPalete ? "280px" : "0" }}>
        <button onClick={() => setColorPalete(!colorPalete)} className={`open-color ${colorPalete ? "d-none" : "d-block"}`}>
          <i className="ti ti-settings-filled"></i>
        </button>
        <button onClick={() => setColorPalete(!colorPalete)} className={`close-color ${colorPalete ? "d-block" : "d-none"}`}>
          <i className="ti ti-x"></i>
        </button>
      </div>
      <div className="color-palate-inner" style={{ right: colorPalete ? "0" : "-280px" }}>
        <div className="group">
          <h6 className="not-cursor">Cursor</h6>
          <ul className="dark-version">
            <li onClick={() => setCustomCursor(true)} className={`cursor-pointer animated-cursor ${CustomCursor ? "active" : ""}`}>
              Animated
            </li>
            <li onClick={() => setCustomCursor(false)} className={`box cursor-pointer default-cursor ${CustomCursor ? "" : "active"}`}>
              Default
            </li>
          </ul>
        </div>
        <div className="group">
          <h6 className="not-cursor">Sidebar</h6>
          <ul className="rtl-version">
            <li onClick={() => setSidebar(true)} className={`cursor-pointer sidebar-yes ${sidebar ? "active" : ""}`}>
              Yes
            </li>
            <li onClick={() => setSidebar(false)} className={`cursor-pointer sidebar-no  ${sidebar ? "" : "active"}`}>
              No
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ColorPalate;
