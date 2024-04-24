import React from 'react';
import '../App.css';
import './fields.css';

function MyComponent() {
    const inputs = Array.from({ length: 50 }, (_, index) => (
        <input key={index} type='text' placeholder={`Field Name ${index + 1}`} />
    ));

    return (
        <div className="main">
            <h1 className='projectName'>NCHLOD</h1>

            <div className='fields'>
                <div className='inputContainer'>{inputs}</div>
            </div>
        </div>
    );
}

export default MyComponent;
