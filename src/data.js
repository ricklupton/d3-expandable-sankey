import { nest, sum } from 'd3-collection';
import { color } from 'd3-color';

function linkId(expanded) {
  return function key(link) {
    return (link.source + (expanded[link.source] ? link.sourceSub : '') +
            link.target + (expanded[link.target] ? link.targetSub : ''));
  };
}

/* Aggregate links according to which nodes are expanded */
export function linksAccessor(expanded) {
  return function links(data) {
    var result = nest()
        .key(linkId(expanded))
        .entries(data.links)
        .map(function(d) {
          var x = d.values[0];
          return {
            id: d.key,
            source: x.source,
            target: x.target,
            sourcePort: expanded[x.source] === true ? 'out-' + x.sourceSub : 'out-',
            targetPort: expanded[x.target] === true ? 'in-' + x.targetSub : 'in-',
            data: {value: sum(d.values, function(x) { return x.data.value; })},
            sublinks: d.values,
            type: d.key, // must make links unique
            style: x.style,
          };
        });

    return result;
  };
}
