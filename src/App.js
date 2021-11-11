import React, { Component } from 'react'
import Video from './Video'
import Home from './Home'
import Three from './Three'
import MediaPipe from "./MediaPipe"
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';

class App extends Component {
	render() {
		return (
			<div>
				<Router>
					<Switch>
            			<Route path="/preview" exact component={Three}/>
						<Route path="/" exact component={Home} />
						{/*<Route path="/:url" component={Video} />*/}
						<Route path="/mediapipe" exact component={MediaPipe} />
						<Route path="/:url" component={Video} />
					</Switch>
				</Router>
			</div>
		)
	}
}

export default App;