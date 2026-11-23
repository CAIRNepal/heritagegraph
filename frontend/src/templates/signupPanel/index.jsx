import React, { useState } from 'react';
import axios from 'axios';
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";

const SignupPanel = () => {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [organization, setOrganization] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignup = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    // Validation checks
    if (email !== confirmEmail) {
      setError('Email addresses do not match.');
      return;
    }
    if (!firstName || !lastName || !email || !birthDate || !organization || !position) {
      setError('All fields are required.');
      return;
    }

    const payload = {
      firstName,
      middleName,
      lastName,
      email,
      birthDate,
      organization,
      position
    };

    console.log(payload);

    try {
      const response = await axios.post('https://nchlod.ddev.site/user/register?_format=json', payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.status === 200) {
        setSuccess('Signup successful!');
      } else {
        setError('Signup failed. Please check your inputs.');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <Layout title="Signup">
      <div className={`dc-page ${config.container}`}>
        <h1>Signup</h1>
        <div className="dc-page-content row">
          <div className="col-md-9 col-sm-12">
            <form onSubmit={handleSignup}>
              <div className="form-group">
                <label htmlFor="firstName">First Name:</label>
                <input
                  type="text"
                  id="firstName"
                  className="form-control"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="middleName">Middle Name:</label>
                <input
                  type="text"
                  id="middleName"
                  className="form-control"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Enter your middle name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name:</label>
                <input
                  type="text"
                  id="lastName"
                  className="form-control"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  type="email"
                  id="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmEmail">Confirm Email:</label>
                <input
                  type="email"
                  id="confirmEmail"
                  className="form-control"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Confirm your email"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="birthDate">Birth Date:</label>
                <input
                  type="date"
                  id="birthDate"
                  className="form-control"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  placeholder="Please Enter your birthdate"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="organization">Organization Name:</label>
                <input
                  type="text"
                  id="organization"
                  className="form-control"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Please Enter your organization name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="position">Position:</label>
                <input
                  type="text"
                  id="position"
                  className="form-control"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Please Enter your current position"
                  required
                />
              </div>
              <button type="submit" className="custom-button">Signup</button>
            </form>
            {error && <div className="alert alert-danger mt-3">{error}</div>}
            {success && <div className="alert alert-success mt-3">{success}</div>}
          </div>
          <div className="col-md-3 col-sm-12">
            <Announcement variation="info" heading="Note">
              <p>Fill out the form to create an account.</p>
            </Announcement>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SignupPanel;
