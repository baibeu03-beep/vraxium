"use client";

import NiceSelectComponent from "@/components/shared/NiceSelect";
import { useState } from "react";

const Withdraw = () => {
  const [activeTab, setActiveTab] = useState("crypto");
  return (
    <div className="private-item__single private-withdraw" id="privateWithdraw">
      <div className="row">
        <div className="col-12 col-xl-8">
          <div className="private-content">
            <div className="withdraw-tab__btns">
              <ul>
                <li>
                  <button className={`withdraw-tab-btn ${activeTab === "crypto" ? "active" : ""}`} onClick={() => setActiveTab("crypto")}>
                    Crypto
                  </button>
                </li>
                <li>
                  <button className={`withdraw-tab-btn ${activeTab === "flat" ? "active" : ""}`} onClick={() => setActiveTab("flat")}>
                    Flat
                  </button>
                </li>
              </ul>
            </div>
            <div className="withdraw-tab__items mt-40">
              {activeTab === "crypto" ? (
                <div className="withdraw-tab__single" id="withdrawCrypto">
                  <form action="#" method="post">
                    <div className="profile-input-group">
                      <label htmlFor="withdrawMethod" className="text-alter fw-6">
                        Choose Payment Method
                      </label>
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
                        placeholder="Select Payment Method"
                        onChange={(selectedValue) => {
                          console.log("Selected payment method:", selectedValue);
                        }}
                      />
                    </div>
                    <div className="profile-input-group mt-30">
                      <label htmlFor="withdrawNetwork" className="text-alter fw-6">
                        Choose Network
                      </label>
                      <NiceSelectComponent
                        options={[
                          { value: "stellar", text: "Stellar" },
                          { value: "ripple", text: "Ripple" },
                          { value: "blockstream", text: "Blockstream" },
                        ]}
                        placeholder="Select Network"
                        onChange={(selectedValue) => {
                          console.log("Selected network:", selectedValue);
                        }}
                      />
                    </div>
                    <div className="profile-input-group mt-30">
                      <label htmlFor="withdrawAddress" className="text-alter fw-6">
                        Withdrawal Address <span className="quaternary-text"> (Note: Only Bitcoin)</span>{" "}
                      </label>
                      <div className="input-wrapper">
                        <input type="text" name="withdraw-address" id="withdrawAddress" placeholder="Fill in carefully according to the specific currency" />
                      </div>
                    </div>
                    <div className="profile-input-group mt-30">
                      <label htmlFor="withdrawAmount" className="text-alter fw-6">
                        Withdraw Amount <span> (Min: 0.001023)</span>{" "}
                      </label>
                      <div className="input-wrapper">
                        <input type="number" name="withdraw-amount" id="withdrawAmount" placeholder="0.00000000" />
                      </div>
                    </div>
                    <div className="buy-details mt-30">
                      <div className="buy-details__inner">
                        <div className="buy-details-group">
                          <p className="text-sm text-alter">Withdraw amount:</p>
                          <p>$0.00</p>
                        </div>
                        <div className="buy-details-group mt-20">
                          <p className="text-sm text-alter">
                            Fee: <i className=""></i>
                          </p>
                          <p>0.000323 XLM</p>
                        </div>
                        <div className="buy-details-group mt-20">
                          <p className="text-sm text-alter">Total withdrawal amount:</p>
                          <p className="quaternary-text">0.00000000 XLM</p>
                        </div>
                      </div>
                    </div>
                    <div className="notice mt-30">
                      <p>
                        <strong className="quaternary-text">Notice:</strong> Do not withdraw any currency other than XLM
                      </p>
                    </div>
                    <div className="form-cta mt-40">
                      <button type="submit" title="Confirm withdraw" className="btn--primary">
                        Withdraw Now
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="withdraw-tab__single" id="withdrawFlat">
                  <form action="#" method="post">
                    <div className="profile-input-group">
                      <label htmlFor="withdrawflatMethod" className="text-alter fw-6">
                        Choose Payment Method
                      </label>
                      <NiceSelectComponent
                        options={[
                          { value: "usd", text: "USD" },
                          { value: "euro", text: "Euro" },
                          { value: "uae", text: "UAE" },
                          { value: "peso", text: "Peso" },
                          { value: "real", text: "Real" },
                          { value: "yen", text: "Yen" },
                        ]}
                        placeholder="Select Payment Method"
                        onChange={(selectedValue) => {
                          console.log("Selected payment method:", selectedValue);
                        }}
                      />
                    </div>
                    <div className="profile-input-group mt-30">
                      <label htmlFor="withdrawflatName" className="text-alter fw-6">
                        Account Holder Name
                      </label>
                      <div className="input-wrapper">
                        <input type="text" name="withdrawflat-name" id="withdrawflatName" placeholder="Enter Name" />
                      </div>
                    </div>
                    <div className="profile-input-group mt-30">
                      <label htmlFor="withdrawflatCode" className="text-alter fw-6">
                        IFSC Code
                      </label>
                      <div className="input-wrapper">
                        <input type="text" name="withdrawflat-code" id="withdrawflatCode" placeholder="Enter Code" />
                      </div>
                    </div>
                    <div className="profile-input-group mt-30">
                      <label htmlFor="withdrawflatNumber" className="text-alter fw-6">
                        Account Number
                      </label>
                      <div className="input-wrapper">
                        <input type="number" name="withdrawflat-number" id="withdrawflatNumber" placeholder="Enter Account Number" />
                      </div>
                    </div>
                    <div className="profile-input-group mt-30">
                      <label htmlFor="withdrawflatAmount" className="text-alter fw-6">
                        Withdraw Amount (100 ~ 25000){" "}
                      </label>
                      <div className="input-wrapper">
                        <input type="number" name="withdrawflat-amount" id="withdrawflatAmount" placeholder="0" />
                      </div>
                    </div>
                    <div className="buy-details mt-30">
                      <div className="buy-details__inner">
                        <div className="buy-details-group">
                          <p className="text-sm text-alter">Withdraw amount:</p>
                          <p>$0.00</p>
                        </div>
                        <div className="buy-details-group mt-20">
                          <p className="text-sm text-alter">
                            Fee: <i className=""></i>
                          </p>
                          <p>0.000323 XLM</p>
                        </div>
                        <div className="buy-details-group mt-20">
                          <p className="text-sm text-alter">Total withdrawal amount:</p>
                          <p className="quaternary-text">0.00000000 XLM</p>
                        </div>
                      </div>
                    </div>
                    <div className="notice mt-30">
                      <p>
                        <strong className="quaternary-text">Notice:</strong> Do not withdraw any currency other than XLM
                      </p>
                    </div>
                    <div className="form-cta mt-40">
                      <button type="submit" title="Confirm withdraw" className="btn--primary">
                        Withdraw Now
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Withdraw;
