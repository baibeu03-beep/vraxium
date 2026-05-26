const MyProfile = () => {
  return (
    <div className="private-item__single private-withdraw private-profile" id="privateProfile">
      <div className="row">
        <div className="col-12 col-xl-9">
          <div className="private-content">
            <h6 className="fw-6 mt-5">My Profile</h6>
            <form action="#" method="post" className="mt-30">
              <div className="profile-input-group">
                <label htmlFor="profileName" className="text-alter fw-6">
                  Name
                </label>
                <div className="input-wrapper mt-12">
                  <input type="text" name="profile-name" id="profileName" required placeholder="David Malan" />
                </div>
              </div>
              <div className="profile-input-group mt-30">
                <label htmlFor="profileEmail" className="text-alter fw-6">
                  Email
                </label>
                <div className="input-wrapper mt-12">
                  <input type="email" name="profile-email" id="profileEmail" required placeholder="example@gmail.com" />
                </div>
              </div>
              <div className="profile-input-group mt-30">
                <label htmlFor="profileNumber" className="text-alter fw-6">
                  Phone Number
                </label>
                <div className="input-wrapper mt-12">
                  <input type="number" name="profile-number" id="profileNumber" required placeholder="+555 111 876 127" />
                </div>
              </div>
              <div className="profile-input-group mt-30">
                <label htmlFor="profileUserName" className="text-alter fw-6">
                  User Name
                </label>
                <div className="input-wrapper mt-12">
                  <input type="text" name="profile-UserName" id="profileUserName" required placeholder="@david" />
                </div>
              </div>
              <div className="profile-input-group mt-30">
                <label htmlFor="profileBio" className="text-alter fw-6">
                  Bio
                </label>
                <div className="input-wrapper mt-12">
                  <textarea name="profile-bio" id="profileBio" placeholder="Depending on the blockchain, the deposit may take  few minutes to 1 hour to arrive."></textarea>
                </div>
              </div>
              <h6 className="fw-6 mt-40">Change Passowrd</h6>
              <div className="profile-input-group mt-24">
                <label htmlFor="profilePassword" className="text-alter fw-6">
                  Current Password
                </label>
                <div className="input-wrapper mt-12">
                  <input type="password" name="profile-Password" id="profilePassword" required value="345u9g9" />
                </div>
              </div>
              <div className="profile-input-group mt-30">
                <label htmlFor="profilenewPassword" className="text-alter fw-6">
                  New Password
                </label>
                <div className="input-wrapper mt-12">
                  <input type="password" name="profile-newPassword" id="profilenewPassword" required placeholder="Enter New Password" />
                </div>
              </div>
              <div className="profile-input-group mt-30">
                <label htmlFor="profileconfirmPassword" className="text-alter fw-6">
                  Confirm Password
                </label>
                <div className="input-wrapper mt-12">
                  <input type="password" name="profile-confirmPassword" id="profileconfirmPassword" required placeholder="Confirm Password" />
                </div>
              </div>
              <div className="form-cta mt-40">
                <button type="submit" title="update profile" className="btn--primary">
                  Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
