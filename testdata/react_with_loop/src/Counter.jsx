
import React, { Component } from 'react';

export class Counter extends Component {

  constructor(props) {
    super(props);

    this.state = {
      count: 0
    };
  }

    increment() {
      const newval = this.state.count + 1 ;
      this.setState({ count: newval });
      this.loop();
    }

    render() {
      return (
        <div className="shopping-list">
          Click count = {this.state.count};
          <div>
            <button id="incrementBtn" onClick={ () => this.increment() } >Increment</button> { }
          </div>
        </div>
      );
    }

    loop() {
      for (let iterationNumber = 1; iterationNumber < 200; ++iterationNumber) {
        console.log(`starting iteration: ${iterationNumber}`);
        const squared = iterationNumber * iterationNumber;
        console.log(`ending iteration: ${iterationNumber} squared: ${squared}`);
      }
    }
  }

