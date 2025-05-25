import React from "react";
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";
import { version, dependencies } from '../../../package.json';

const About = () => (
    <Layout title="About">
        <div className={`dc-page ${config.container}`}>
            <h1>About Heritage Graph</h1>
            <div className="dc-page-content row">
            <div className="col-md-9 col-sm-12" style={{ textAlign: "justify" }}>
    Cultural heritage embodies the collective memory, identity, and wisdom of humanity, thereby influencing our present and future while providing invaluable insights into our shared past. In the digital age, it is essential to digitize cultural heritage to guarantee its accessibility, preservation, and ongoing significance. By digitizing artifacts, documents, and traditions, we effectively protect them from physical degradation and loss. This process democratizes access to invaluable cultural assets, allowing for greater engagement and education from a wider audience. Moreover, digitalization advances interdisciplinary research, collaboration, and innovation, offering novel opportunities to comprehend and interpret our cultural heritage. Safeguarding the fundamental nature of cultural heritage for future generations promotes cultural comprehension and exchange, enabling present and future generations to reconnect with their origins and chart new courses.
</div>

                <div className="col-md-3 col-sm-12">
                    <Announcement variation="info" heading="Heritage Graph">
                        Together we can showcase our rich Nepalese Cultural Heritage through state of the art methodology 
                    </Announcement>
                </div>
        
                <div className="col-md-9 col-sm-12" style={{ textAlign: "justify" }}>
                <h1>Our Mission</h1>
                At HeritageGraph, our mission is to digitize cultural heritage using knowledge graphs (KGs). KGs capture complex information in a format that is both machine-readable and human-comprehensible. They provide a powerful visual representation of interconnected concepts, entities, and relationships, enabling meaningful insights derived from disparate data sources. Through this project, we focus on creating a machine-processable knowledge representation of Nepalese cultural heritage, ensuring its preservation and accessibility for generations to come.
</div>
            </div>
            <br/>
            <br/>

     
            <div className="dc-page-content row">
                <div className="col-12">
                    {/* <p>data-catalog-app: {version}</p>
                    <p>data-catalog-components: {dependencies["@civicactions/data-catalog-components"]}</p> */}
                </div>  
            </div>
        </div>
    </Layout>
);

export default About;
