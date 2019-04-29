import * as path from 'path';
import * as testSetup from '../testSetup';
import { TestProjectSpec } from '../framework/frameworkTestSupport';

const DATA_ROOT = testSetup.DATA_ROOT;
const REACT_PROJECT_ROOT = path.join(DATA_ROOT, 'react', 'dist');
export const reactTestSpecification = new TestProjectSpec({ projectRoot: REACT_PROJECT_ROOT });
export const reactWithLoopTestSpecification = new TestProjectSpec({ projectRoot: path.join(DATA_ROOT, 'react_with_loop', 'dist') });
