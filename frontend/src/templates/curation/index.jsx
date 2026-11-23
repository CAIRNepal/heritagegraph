import React from "react";
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";

const Curation = () => (
    <Layout title="Curation">
        <div className={`dc-page ${config.container}`}>
            <h1>Curation</h1>
            <div className="dc-page-content row">
                <div className="col-md-9 col-sm-12">
                    <p>Welcome to the Curation page.</p>
                    <p>
                    Learn about our data curation process, including how data is reviewed, 
                    validated, and added to the catalog.
                    </p>
                    <h2>Data Curation Process</h2>
                    <p>
                    Our data curation process ensures the accuracy and quality of the data 
                    in our catalog. We follow a set of standards and guidelines to curate the data effectively.
                    </p>
                </div>
                <div className="col-md-3 col-sm-12">
                    <Announcement variation="info" heading="Note">
                    <p>Check back for updates on our curation process and new data additions.</p>
                    </Announcement>
                </div>
            </div>
        </div>
    </Layout>
);

export default Curation;
