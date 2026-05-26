"use client";

import { useState } from "react";

const faqData = {
  generalfaq: [
    {
      question: "What is NFTG?",
      answer: "NFTG (NFT Gaming) is a platform that combines blockchain technology with gaming, allowing players to own, trade, and earn from in-game assets in the form of NFTs.",
    },
    {
      question: "How do I get started with NFTG?",
      answer: "To get started, create an account on our website, connect your wallet, and explore our available games and tournaments. You can also purchase or earn NFTs to use in our ecosystem.",
    },
    {
      question: "What cryptocurrencies does NFTG support?",
      answer: "NFTG currently supports Ethereum (ETH) and our native token, Alpha Coins. We plan to add support for more cryptocurrencies in the future.",
    },
  ],
  tournamentsfaq: [
    {
      question: "How do I join a tournament?",
      answer: "To join a tournament, navigate to the 'Tournaments' section, choose an event you're interested in, and click 'Join'. Make sure you meet the entry requirements and have the necessary NFTs or tokens.",
    },
    {
      question: "What types of tournaments does NFTG offer?",
      answer: "NFTG offers various tournament types, including solo competitions, team battles, and special themed events. Each tournament has its own set of rules and rewards.",
    },
    {
      question: "How are tournament winners determined?",
      answer: "Tournament winners are determined based on the specific rules of each event. This can include factors such as highest score, fastest completion time, or most opponents defeated.",
    },
  ],
  teamfaq: [
    {
      question: "How do I create or join a team?",
      answer: "To create a team, go to the 'Teams' section and click 'Create Team'. To join an existing team, you can either accept an invitation or request to join a team that's open for new members.",
    },
    {
      question: "What are the benefits of being in a team?",
      answer: "Being in a team allows you to participate in team tournaments, share strategies, and potentially earn more rewards through collaborative play and team achievements.",
    },
    {
      question: "How many members can a team have?",
      answer: "The maximum number of members in a team can vary depending on the game or tournament. Generally, teams can have between 3 to 10 members.",
    },
  ],
  brandfaq: [
    {
      question: "How can brands collaborate with NFTG?",
      answer: "Brands can collaborate with NFTG by sponsoring tournaments, creating branded NFTs, or integrating their products into our gaming ecosystem. Contact our partnerships team for more information.",
    },
    {
      question: "What benefits do brands get from partnering with NFTG?",
      answer: "Brands can gain exposure to our engaged gaming community, create unique digital assets, and participate in the growing NFT and blockchain gaming market.",
    },
    {
      question: "Are there any requirements for brand partnerships?",
      answer: "We look for brands that align with our values and can add value to our gaming ecosystem. Specific requirements may vary based on the type of partnership.",
    },
  ],
  accountfaq: [
    {
      question: "How do I reset my password?",
      answer: "To reset your password, click on the 'Forgot Password' link on the login page. Follow the instructions sent to your registered email to create a new password.",
    },
    {
      question: "Can I change my username?",
      answer: "Yes, you can change your username once every 30 days. Go to your account settings and select 'Change Username' to update it.",
    },
    {
      question: "How do I link or unlink a wallet from my account?",
      answer: "To link or unlink a wallet, go to your account settings and navigate to the 'Linked Wallets' section. Here you can add new wallets or remove existing ones.",
    },
  ],
};

const Faq = () => {
  const [activeTab, setActiveTab] = useState("generalfaq");

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <section className="faq pt-120 pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="text-center mb-55">
              <h2 className="title-lg fw-8 stroked-text transform-none title-animation mt-8">Faq</h2>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-lg-4">
            <div className="faq__sidebar">
              <div className="faq__sidebar-inner">
                <ul>
                  {Object.keys(faqData).map((tabId) => (
                    <li key={tabId}>
                      <button onClick={() => handleTabClick(tabId)} className={`faq-tab-btn ${activeTab === tabId ? "active" : ""}`}>
                        {tabId.charAt(0).toUpperCase() + tabId.slice(1).replace("faq", "")}
                        <i className="ti ti-arrow-up-right"></i>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-7 offset-lg-1">
            <div className="faq__content">
              <div className="faq__tab">
                {Object.entries(faqData).map(([tabId, questions]) => (
                  <div key={tabId} className={`faq__tab-single ${activeTab === tabId ? "d-block" : "d-none"}`} id={tabId}>
                    <div className="faq__content-inner">
                      <div className="accordion" id={`accordion${tabId}`}>
                        {questions.map((item, index) => (
                          <div key={index} className="accordion-item">
                            <h5 className="accordion-header" id={`heading${tabId}${index}`}>
                              <button className={`accordion-button ${index !== 0 ? "collapsed" : ""}`} type="button" data-bs-toggle="collapse" data-bs-target={`#collapse${tabId}${index}`} aria-expanded={index === 0 ? "true" : "false"} aria-controls={`collapse${tabId}${index}`}>
                                {item.question}
                              </button>
                            </h5>
                            <div id={`collapse${tabId}${index}`} className={`accordion-collapse collapse ${index === 0 ? "show" : ""}`} aria-labelledby={`heading${tabId}${index}`} data-bs-parent={`#accordion${tabId}`}>
                              <div className="accordion-body">
                                <p>{item.answer}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Faq;
