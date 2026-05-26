"use client";
const Prizes = () => {
  const prizeData = [
    { placement: "1st", currentPrize: "$750.00", potentialPrize: "$750.00" },
    { placement: "2nd", currentPrize: "$650.00", potentialPrize: "$650.00" },
    { placement: "3rd", currentPrize: "$600.00", potentialPrize: "$600.00" },
    { placement: "4th", currentPrize: "$500.00", potentialPrize: "$500.00" },
    { placement: "5th", currentPrize: "$500.00", potentialPrize: "$500.00" },
    { placement: "6th", currentPrize: "$500.00", potentialPrize: "$500.00" },
    { placement: "7th", currentPrize: "$500.00", potentialPrize: "$500.00" },
    { placement: "8th", currentPrize: "$500.00", potentialPrize: "$500.00" },
    { placement: "9th", currentPrize: "$500.00", potentialPrize: "$500.00" },
    { placement: "10th", currentPrize: "$500.00", potentialPrize: "$500.00" },
    { placement: "11th - 20th", currentPrize: "$400.00", potentialPrize: "$400.00" },
    { placement: "21th - 30th", currentPrize: "$300.00", potentialPrize: "$300.00" },
  ];
  return (
    <>
      <div className="tournament-tab__single" id="tournamentPrize">
        <div className="common-space tournament-prize">
          {/* <!-- Button trigger modal --> */}

          <h5 className="mt-8 fw-6">Prizes Pool</h5>
          <div className="table-responsive mt-30">
            <table>
              <thead>
                <tr>
                  <th>Placement</th>
                  <th>Current Prize</th>
                  <th>Potential Prize</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {prizeData.map((prize, index) => (
                  <tr key={index}>
                    <td>{prize.placement}</td>
                    <td>{prize.currentPrize}</td>
                    <td>{prize.potentialPrize}</td>
                    <td>
                      <button className="details-prize-btn d-flex align-items-center w-100 justify-content-end gap-1" data-bs-toggle="modal" data-bs-target="#exampleModal">
                        View Details
                        <i className="ti ti-chevron-right"></i>{" "}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* <!-- Modal --> */}
      <div className="modal fade" id="exampleModal" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content bg-transparent">
            <div className="prize-popup">
              <div className="prize-popup__inner">
                <button type="button" className="close-btn fs-3" data-bs-dismiss="modal" aria-label="Close">
                  <i className="ti ti-x"></i>
                </button>
                <div className="text-center">
                  <div className="intro">
                    <h5>1st</h5>
                    <p>Place</p>
                  </div>
                  <h3 className="mt-30 fw-6">$750.00</h3>
                  <p className="text-alter mt-10">Potential</p>
                </div>
                <div className="prize-footer mt-30">
                  <p className="text-alter mt-8">Description</p>
                  <p className="text-alter mt-10">Finishing this tournament in this bracket grants you a total of</p>
                  <p className="mt-16 quaternary-text">$750.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Prizes;
