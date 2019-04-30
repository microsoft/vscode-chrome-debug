import React, { Component } from 'react';
import { Counter } from './Counter';
import { runForever } from './Running';

class App extends Component {
  render() {
    return (
      <Counter ></Counter>
    );
  }
}

runForever();

export default App;
