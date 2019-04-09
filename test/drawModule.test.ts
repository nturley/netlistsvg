import { ElkModel } from '../lib/elkGraph';
import { removeDummyEdges } from '../lib/drawModule';

test('remove dummy edges', () => {
    // this test case came from hyperedges.json
    const e5Start = {x: 159, y: 162};
    const e6Start = {x: 159, y: 97};
    const e7Start = {x: 159, y: 32};
    const initEnd = {x: 202, y: 97};
    const testGraph: ElkModel.Graph = {
        id: 'fake id',
        children: [],
        edges:
        [
            {
                id: 'e5',
                source: 'i0',
                sourcePort: 'i0.Y',
                target: '$d_0',
                targetPort: '$d_0.p',
                sections:
                [
                    {
                        id: 'e5_s0',
                        startPoint: e5Start,
                        endPoint: initEnd,
                        bendPoints: [
                            {x: 177, y: 162},
                            {x: 177, y: 97},
                        ],
                    },
                ],
            },
            {
                id: 'e6',
                source: 'i1',
                sourcePort: 'i1.Y',
                target: '$d_0',
                targetPort: '$d_0.p',
                sections:
                [
                    {
                        id: 'e6_s0',
                        startPoint: e6Start,
                        endPoint: initEnd,
                    },
                ],
            },
            {
                id: 'e7',
                source: 'i4',
                sourcePort: 'i4.Y',
                target: '$d_0',
                targetPort: '$d_0.p',
                sections:
                [
                    {
                        id: 'e7_s0',
                        startPoint: e7Start,
                        endPoint: initEnd,
                        bendPoints:
                        [
                            {x: 177, y: 32},
                            {x: 177, y: 97},
                        ],
                    },
                ],
                junctionPoints:
                [
                    {x: 177, y: 97},
                ],
            },
        ],
    };
    removeDummyEdges(testGraph);
    const e5 = testGraph.edges.find((edge) => edge.id === 'e5');
    const e6 = testGraph.edges.find((edge) => edge.id === 'e6');
    const e7 = testGraph.edges.find((edge) => edge.id === 'e7');
    expect(e5.sections[0].startPoint).toEqual(e5Start);
    expect(e6.sections[0].startPoint).toEqual(e6Start);
    expect(e7.sections[0].startPoint).toEqual(e7Start);
    expect(e5.sections[0].endPoint.x).not.toEqual(initEnd);
    expect(e6.sections[0].endPoint.x).not.toEqual(initEnd);
    expect(e7.sections[0].endPoint.x).not.toEqual(initEnd);
});

function findEdge(graph: ElkModel.Graph, id: string): ElkModel.Edge {
    return graph.edges.find((edge) => edge.id === id);
}
