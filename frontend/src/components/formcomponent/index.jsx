import React, { useState, useEffect } from 'react';

const MyComponent = ({ uuid }) => {
    const [formData, setFormData] = useState(null);

    useEffect(() => {
        if (!uuid) return;
        const fetchData = async () => {
            try {
                const response = await fetch(`https://nchlod.ddev.site/webform_rest/heritage_graph/submission/${uuid}`);
                const responseData = await response.json();
                setFormData(responseData.data);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, [uuid]);

    return (
        <div>
            {formData ? (
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>First Name</th>
                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Last Name</th>
                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formData.enter_your_first_name}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formData.enter_your_last_name}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formData.enter_your_email}</td>
                        </tr>
                    </tbody>
                </table>
            ) : (
                <p>No data available</p>
            )}
        </div>
    );
};

export default MyComponent;
