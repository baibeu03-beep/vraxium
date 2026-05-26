"use client";

import { useState } from "react";

const Transaction = () => {
  const [activeTab, setActiveTab] = useState("transactionDeposit");

  const transactionData = [
    { date: "17.06.2023 12:45:33", currency: "USDC", amount: "0.000045706", action: "Completed" },
    { date: "18.06.2023 12:45:33", currency: "TRX", amount: "0.000045706", action: "Swap" },
    { date: "19.06.2023 12:45:33", currency: "XLM", amount: "0.000045706", action: "Deposit" },
    { date: "19.06.2023 12:45:33", currency: "TRX", amount: "0.000045706", action: "Buy Crypto" },
    { date: "19.06.2023 12:45:33", currency: "USDT", amount: "0.000045706", action: "Swap" },
    { date: "20.06.2023 12:45:33", currency: "BTC", amount: "0.000045706", action: "Completed" },
    { date: "21.06.2023 12:45:33", currency: "XLM", amount: "0.000045706", action: "Deposit" },
    { date: "22.06.2023 12:45:33", currency: "BNB", amount: "0.000045706", action: "Withdraw" },
  ];

  const tabButtons = [
    { id: "transactionDeposit", text: "Deposit" },
    { id: "transactionWithdraw", text: "Withdraw" },
    { id: "transactionProgress", text: "In Progress" },
    { id: "transactionAction", text: "Action" },
  ];

  return (
    <div className="private-content__single private-transaction" id="privateTransaction">
      <div className="transaction-tab__btns">
        <ul>
          {tabButtons.map((button) => (
            <li key={button.id}>
              <button onClick={() => setActiveTab(button.id)} className={`transaction-tab-btn ${activeTab === button.id ? "active" : ""}`}>
                {button.text} <i className="ti ti-chevron-right"></i>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="transaction-tab-items mt-30">
        <div className={`transaction-tab-single`}>
          <div className="private-content">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th className="fw-6">Date / Time</th>
                    <th className="fw-6">Currency</th>
                    <th className="fw-6">Amount</th>
                    <th className="fw-6">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionData.map((transaction, index) => (
                    <tr key={index}>
                      <td>{transaction.date}</td>
                      <td>{transaction.currency}</td>
                      <td>{transaction.amount}</td>
                      <td>{transaction.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transaction;
