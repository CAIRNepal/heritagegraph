import React, { useState, useEffect } from 'react';
import { Table } from 'antd';

const UUIDFetcher = () => {
    const [uuids, setUuids] = useState([]);
    const [selectedUuid, setSelectedUuid] = useState(null);
    const [error, setError] = useState(null);

    
    useEffect(() => {
        const fetchUuids = async () => {
            try {
                const response = await fetch('https://nchlod.ddev.site/jsonapi/webform_submission/heritage_graph');
                if (!response.ok) {
                    throw new Error('Failed to fetch UUIDs');
                }
                const responseData = await response.json();
                const uuids = responseData.data.map(item => item.id);
                setUuids(uuids);
            } catch (error) {
                setError('Error fetching UUIDs');
                console.error('Error fetching UUIDs:', error);
            }
        };

        fetchUuids();
    }, []);

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div>
            <Table
                columns={[
                    {
                        title: 'UUID',
                        dataIndex: 'id',
                        key: 'id',
                        render: uuid => (
                            <div onClick={() => setSelectedUuid(uuid)} style={{ cursor: 'pointer', color: 'blue' }}>
                                {uuid}
                            </div>
                        ),
                    },
                ]}
                dataSource={uuids.map(uuid => ({ id: uuid }))}
            />
        </div>
    );
};

export default UUIDFetcher;
