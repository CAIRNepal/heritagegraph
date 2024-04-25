import React from 'react';
import '../App.css';
import './fields.css';

function MyComponent() {
    const inputs = Array.from({ length: 48 }, (_, index) => (
        <input key={index} className='inputContainer' type='text' placeholder={`Field Name ${index + 1}`} />
    ));

    return (
        <div className="main">
            <h1 className='projectName'>NCHLOD</h1>

            <div className='fields'>
                {inputs}
            </div>
        </div>
    );
}

export default MyComponent;
