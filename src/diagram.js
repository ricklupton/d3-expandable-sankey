import { select } from 'd3-selection';
import { interpolate } from 'd3-interpolate';
import { format } from 'd3-format';
import { timeout } from 'd3-timer';
import { dispatch } from 'd3-dispatch';
import { color } from 'd3-color';
import { map } from 'd3-collection';
import 'd3-transition';
// import { sankey, sankeyLink, sankeyNode } from 'd3-sankey-diagram';
import { sankey, sankeyLink } from 'd3-sankey-diagram';
import sankeyNode from './node.js';
import { linksAccessor } from './data';

var numberFormat0 = format('.1f');

function numberFormat(x) {
  return numberFormat0(x / 1e9) + ' Gt';
}

var nodeWidth = 60;

export default function expandableSankey() {
  var scale = 1;
  var expanded = {};

  var listeners = dispatch('clickNode');

  function exports(selection) {
    selection.each(function(data) {

      // Prepare node info
      prepareNodes(data, scale);

      // Select the svg element, and add groups if first time
      var svg = select(this);
      if (svg.selectAll('.links').empty()) {
        svg.append('g').attr('class', 'groups');
        svg.append('g').attr('class', 'links');
        svg.append('g').attr('class', 'nodes');
      }

      // Configure layout
      var layout = sankey()
          .links(linksAccessor(expanded))
          .linkValue(function (d) { return d.data.value; })
          .nodePosition(function(d) { return [parseInt(d.geometry.x, 10), d.geometry.y]; })
          .nodeWidth(nodeWidth)
          .sortPorts(function(a, b) { return portOrder(a) - portOrder(b); })
          .scale(scale);

      var linkPath = sankeyLink()
          .minWidth(function(d) { return 0.1; });

      var snode = sankeyNode()
          .nodeVisible(function(d) { return !d.style.hidden; })
          .nodeTitle(function(d) {
            var t = d.title + '  ' + numberFormat0(d.value / 1e9);
            return expanded[d.id] ? t.replace('\n', ' ') : t;
          });

      // Prepare groups of nodes
      graph = layout(data);
      const nodeMap = map(graph.nodes, n => n.id);
      const groupsPositioned = (data.groups || []).map(g => positionGroup(nodeMap, g));

      // Track whether anything is being hovered
      var hover = false;

      // Disable hovering during transitions;
      var hoverEnabled = true;

      var graph;
      relayoutAndRender();

      function relayoutAndRender(skipSubs) {
        graph = layout(data);
        renderLinks(graph.links);
        renderNodes(graph.nodes, skipSubs);
        updateGroups(groupsPositioned);
      }

      function targetSub(link) {
        return link.targetPort.node.subdiv[link.targetPort.id] || {};
      }

      function sourceSub(link) {
        return link.sourcePort.node.subdiv[link.sourcePort.id] || {};
      }

      function linkColour(d) {
        return subColor(d.sourcePort.node, sourceSub(d).index);
      }

      function subOpacity(d) {
        return !hover || d.node.hover || d.hover ? 1 : 0.5;
      }

      function linkOpacity(d) {
        return !hover || d.source.hover || d.target.hover || sourceSub(d).hover || targetSub(d).hover ? 1 : 0.5;
      }

      function linkSort(a, b) {
        if (sourceSub(a).hover || a.source.hover || targetSub(a).hover || a.target.hover) return 1;
        if (sourceSub(b).hover || b.source.hover || targetSub(b).hover || b.target.hover) return -1;
        return a.source.dy - b.source.dy;
      }

      function portOrder(p) {
        var sub = p.node.subdiv[p.id];
        return sub ? sub.index : 0;
      }

      function portTitle(p) {
        var n = p.node;
        var label = n.subdiv[p.id] ? n.subdiv[p.id].title : '';
        return n.title + (label ? ' (' + label + ')' : '');
      }

      function subColor(node, index) {
        var c = color(node.color || 'grey');
        var k = 0.3;
        return '' + (((index % 2) === 1) ? c.brighter(k) : c.darker(k));
      }

      function nodeSubdivisions(d) {
        var def = [{id: '', node: d, value: d.value, y: 0, dy: d.y1 - d.y0}];
        return expanded[d.id] && d.subdivisions.length ? d.subdivisions : def;
      }

      function titleTransform (d) {
        return expanded[d.id] || d.dy < 10 ? 'translate(-4,-8)' : 'translate(4,' + (d.dy / 2) + ')';
      }

      function renderLinks(links) {
        var link = svg.select('.links')
            .selectAll('g')
            .data(links, function(d) { return d.id; });

        // EXIT
        link.exit().remove();

        // UPDATE
        link.transition()
          .style('opacity', linkOpacity);

        link
          .select('path')
          .transition()
          .duration(1000)
          .attrTween('d', interpolateLink);

        // ENTER
        var linkEnter = link.enter()
            .append('g')
            .attr('class', 'link');

        linkEnter.append('path')
          .each(function (d) { this._current = d; })
          .attr('d', linkPath);

        linkEnter.append('title')
          .text(function(d) {
            return portTitle(d.sourcePort) + ' → ' + portTitle(d.targetPort) +
              ': ' + numberFormat(d.data.value); });

        // UPDATE & ENTER
        link = link.merge(linkEnter);
        link.sort(linkSort);
        link.select('path').style('fill', linkColour);
      }

      function renderNodes(nodes, skipSubs) {
        var node = svg.select('.nodes')
            .selectAll('g.node')
            .data(nodes);

        // ENTER
        var nodeEnter = node.enter()
            .append('g')
            .attr('class', 'node')
            .call(snode);

        // Reposition node titles.
        nodeEnter.select('text.node-title')
          .attr('transform', titleTransform);

        nodeEnter.insert('g', ':first-child').classed('subdivisions', true);

        nodeEnter.on('click', function(d) {
          expandOrCollapseNode(d);
          listeners.apply('clickNode', this, arguments);
        });

        // UPDATE & ENTER
        node = node.merge(nodeEnter);
        node.call(snode);
        if (!skipSubs) updateSubs(node);

        node.select('text.node-title')
          .transition()
          .attr('transform', titleTransform)
          .style('fill', function(d) { return expanded[d.id] ? '#333' : '#000'; });
      }

      function expandOrCollapseNode(d) {
        if (!expanded[d.id]) {
          hoverEnabled = false;
          expanded[d.id] = 'temp';
          relayoutAndRender(true);
          expanded[d.id] = true;
          relayoutAndRender();
          timeout(function() {
            hoverEnabled = true;
          }, 1000);
        } else {
          hoverEnabled = false;
          expanded[d.id] = 'temp';
          d.hover = true;
          relayoutAndRender();
          timeout(function() {
            expanded[d.id] = false;
            relayoutAndRender();
            d.hover = false;
            hoverEnabled = true;
          }, 1000);
        }
      }

      function updateSubs(node) {
        var subs = node.select('.subdivisions')
            .selectAll('.sub')
            .data(nodeSubdivisions, function(d) { return d.id; });

        // EXIT
        subs.exit().remove();

        // UPDATE
        subs.transition().style('opacity', subOpacity);

        // ENTER
        var subsEnter = subs.enter()
            .append('g')
            .attr('class', 'sub');

        subsEnter.on('mouseover', function(d) {
          if (!hoverEnabled) return;
          hover = true;

          // If it's the default subdivision, set hover on the whole node
          if (d.id === '') d.node.hover = true;
          else d.hover = true;

          renderNodes(graph.nodes);
          renderLinks(graph.links);
        });

        subsEnter.on('mouseout', function(d) {
          if (!hoverEnabled) return;
          hover = d.hover = d.node.hover = false;
          renderNodes(graph.nodes);
          renderLinks(graph.links);
        });

        // spread by 0.5px each side to avoid gaps
        subsEnter.append('rect')
          .attr('x', -0.5)
          .attr('width', 61);

        subsEnter.append('text')
          .attr('dy', '0.35em');

        subsEnter.append('title');

        // UPDATE & ENTER
        subs = subs.merge(subsEnter);

        subs.attr('transform', function(d) { return 'translate(0,' + d.y + ')'; });

        subs.select('rect')
          .attr('height', function(d) { return d.dy; })
          .style('fill', function(d) { return subColor(d.node, d.index); });

        subs.select('text')
          .attr('transform', function(d) { return 'translate(4,' + (d.dy / 2) + ')'; })
          .text(function(d) { return d.dy > 10 ? d.label : ''; });

        subs.select('title')
          .text(function(d) { return d.label; });
      }

      function interpolateLink (b) {
        // XXX should limit radius better
        b.points.forEach(function (p) {
          if (p.ri > 1e3) p.ri = 1e3;
          if (p.ro > 1e3) p.ro = 1e3;
        });
        var interp = interpolate(linkGeom(this._current), b);
        var that = this;
        return function (t) {
          that._current = interp(t);
          return linkPath(that._current);
        };
      }

      function updateGroups(groups) {
        let group = svg.select('.groups').selectAll('.group')
            .data(groups);

        // EXIT
        group.exit().remove();

        // ENTER
        const enter = group.enter().append('g')
              .attr('class', 'group');
        // .on('click', selectGroup);

        enter.append('rect');
        enter.append('text')
          .attr('x', 0)
          .attr('y', -15);

        group = group.merge(enter);

        group
          .style('display', d => d.title ? 'inline' : 'none')
          .attr('transform', d => `translate(${d.rect.left},${d.rect.top})`)
          .select('rect')
          .attr('x', -10)
          .attr('y', -10)
          .attr('width', d => d.rect.right - d.rect.left + 20)
          .attr('height', d => d.rect.bottom - d.rect.top + 20);

        group.select('text')
          .text(d => d.title);
      }
    });
  }

  exports.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return this;
  };

  exports.on = function () {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? exports : value;
  };

  return exports;
}

function linkGeom (l) {
  return {
    points: l.points,
    dy: l.dy
  };
}

function prepareNodes (data, scale) {
  data.nodes.forEach(function(d) {
    d.subdiv = {};
    var y = 0;
    d.subdivisions.forEach(function(sub, i) {
      sub.node = d;
      sub.dy = scale * sub.value;
      sub.y = y;
      y += sub.dy;
      sub.index = i;
      d.subdiv[sub.id] = d.subdiv['in-' + sub.id] = d.subdiv['out-' + sub.id] = sub;
    });
  });
}

function positionGroup (nodes, group) {
  const rect = {
    top: Number.MAX_VALUE,
    left: Number.MAX_VALUE,
    bottom: 0,
    right: 0
  };

  group.nodes.forEach(n => {
    const node = nodes.get(n);
    if (!node) return;
    if (node.x0 < rect.left) rect.left = node.x0;
    if (node.x1 > rect.right) rect.right = node.x1;
    if (node.y0 < rect.top) rect.top = node.y0;
    if (node.y1 > rect.bottom) rect.bottom = node.y1;
  });

  group.rect = rect;
  return group;
}
