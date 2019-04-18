import { loadProjectLabels } from '../labels';
import { expect } from 'chai';

suite('Test framework tests', () => {
    test('Should correctly find breakpoint labels in test source files', async () => {
        let labels = await loadProjectLabels('./testdata');
        let worldLabel = labels.get('WorldLabel');

        expect(worldLabel.path).to.eql('testdata\\labelTest.ts');
        expect(worldLabel.line).to.eql(9);
    });

    test('Should correctly find block comment breakpoint labels in test source files', async () => {
        let labels = await loadProjectLabels('./testdata');
        let blockLabel = labels.get('blockLabel');

        expect(blockLabel.path).to.eql('testdata\\labelTest.ts');
        expect(blockLabel.line).to.eql(10);
    });
});