"use client";
import NiceSelectComponent from "@/components/shared/NiceSelect";
import { useState } from "react";

const Vault = () => {
  const [activeTab, setActiveTab] = useState<"in" | "out">("in");
  return (
    <div className="private-content__single" id="privateVault">
      <div className="private-content buy-crypto vault">
        <div className="vault-tab__btns">
          <ul>
            <li>
              <button onClick={() => setActiveTab("in")} className={`vault-tab-btn ${activeTab === "in" ? "active" : ""}`}>
                Transfer In
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab("out")} className={`vault-tab-btn ${activeTab === "out" ? "active" : ""}`}>
                Transfer Out
              </button>
            </li>
          </ul>
        </div>
        <div className="vault-tab__items mt-30">
          {activeTab === "in" ? (
            <div className="vault-tab-single" id="vaultIn">
              <div className="content">
                <p className="text-alter">
                  Annual Percentage Rate <span className="quaternary-text"> 5%</span>
                </p>
                <form action="#" method="post">
                  <div className="profile-input-group mt-30">
                    <label htmlFor="transferInAmount" className="text-alter fw-6">
                      Wallet Balance: <span className="quaternary-text">0</span>
                    </label>
                    <div className="input-wrapper">
                      <input type="number" name="transfer-in-amount" id="transferInAmount" required placeholder="0" />
                      <NiceSelectComponent
                        options={[
                          { value: "XLM", text: "XLM" },
                          { value: "USDT", text: "USDT" },
                          { value: "BTC", text: "BTC" },
                          { value: "ETH", text: "ETH" },
                          { value: "TRX", text: "TRX" },
                          { value: "BNB", text: "BNB" },
                          { value: "BCD", text: "BCD" },
                        ]}
                        placeholder="Select"
                        onChange={(selectedValue) => {
                          console.log("Selected currency:", selectedValue);
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-cta mt-40">
                    <button type="submit" title="Confirm deposit" className="btn--primary">
                      Transfer to Vault Pro
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="vault-tab-single" id="vaultOut">
              <div className="content">
                <p className="text-alter">
                  Annual Percentage Rate <span className="quaternary-text"> 25%</span>
                </p>
                <form action="#" method="post">
                  <div className="profile-input-group mt-30">
                    <label htmlFor="transferOutAmount" className="text-alter fw-6">
                      Wallet Balance: <span className="quaternary-text">0</span>
                    </label>
                    <div className="input-wrapper">
                      <input type="number" name="transfer-out-amount" id="transferOutAmount" required placeholder="0" />
                      <NiceSelectComponent
                        options={[
                          { value: "XLM", text: "XLM" },
                          { value: "USDT", text: "USDT" },
                          { value: "BTC", text: "BTC" },
                          { value: "ETH", text: "ETH" },
                          { value: "TRX", text: "TRX" },
                          { value: "BNB", text: "BNB" },
                          { value: "BCD", text: "BCD" },
                        ]}
                        placeholder="Select"
                        onChange={(selectedValue) => {
                          console.log("Selected currency:", selectedValue);
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-cta mt-40">
                    <button type="submit" title="Confirm deposit" className="btn--primary">
                      Transfer to Vault Pro
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Vault;
