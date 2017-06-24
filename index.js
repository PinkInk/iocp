var app = angular.module("app", []);

app.controller("main", function($scope, $http, $interval) {

    $scope.start = new Date(new Date().setHours(0,0,0,0));
    $scope.end = new Date(new Date().setHours(23,59,59,999));
    width = 600;
    height = 600;
    radius = Math.min(width,height)/2;
    margin = {left:50, right:50, top:50, bottom:50 }
    hours = d3.timeHours($scope.start, $scope.end, 1);
    // radial scales
    radii = {};
    radii["r"] = d3.scaleLinear()
                    .domain([0, 1])
                    .range([radius/2, radius]);

    // range button handlers
    $scope.daysadd = function(sdt, edt, i) {
        sdt.setDate(sdt.getDate()+i);
        edt.setDate(edt.getDate()+i);
        $scope.radialchartUpdate();
    };
    $scope.monthsadd = function(sdt, edt, i) {
        sdt.setMonth(sdt.getMonth()+i);
        edt.setMonth(edt.getMonth()+i);
        $scope.radialchartUpdate();
    };

    // update most recent datapoint
    $scope.updateLiveView = function() {
        $http.get("/iocp/current?node="+ $scope.selectedNode)
            .then(function(response) {
                $scope.sample = response.data[0];
                $scope.timestamp = new Date($scope.sample["timestamp"]);
                $scope.datapoints = Object.keys($scope.sample).filter(
                    function(k) {
                        return !(k=="node"|k=="timestamp"|k=="_id");
                    }
                );
            });
    };
    // time elapsed since most recent datapoint
    $scope.updateTimeElapsed = function() {
        dt = new Date(new Date() - $scope.timestamp);
        dt /= 1000; // strip ms
        $scope.dSeconds = Math.round(dt%60);
        dt = Math.floor(dt/60); // stip s
        $scope.dMinutes = Math.round(dt%60);
        dt = Math.floor(dt/60); // stip m
        $scope.dHours = Math.round(dt/24);
        dt = Math.floor(dt/24);
        $scope.dDays = dt;
    };

    // chart setup
    canvas = d3.select("#graph")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    chart = canvas.append("g")
            // translate & rotate coordinate space
            .attr(
                "transform", "translate("
                + ((width / 2) + margin.left) + ","
                + ((height / 2) + margin.top) + ")"
                + " rotate(180)"
            );

    // radial axis
    gr = chart.append("g")
        .selectAll("g")
            .data(radii.r.ticks(10))
            .enter().append("g")
    gr.append("circle")
        .attr("r", radii.r)
        .attr("style", "fill:none; stroke:grey; stroke-dasharray:1,2;");

    // angular scale
    a = d3.scaleLinear()
        .domain([$scope.start, $scope.end])
        .range([0, Math.PI*2])

    // angular axis
    // TODO: only works for 0-24 constraint
    ga = chart.append("g")
        .selectAll("g")
            .data(hours.map( (d) => a(d)*(180/Math.PI) ))
            .enter().append("g")
                .attr("transform", (d) => "rotate(" + (d - 90) + ")" )
    ga.append("line")
        .attr("x1", radius/2)
        .attr("x2", radius)
        .attr("style", "stroke:black");
    ga.append("text")
        .attr("x", radius + 6)
        .attr("dy", ".35em")
        .text ( (d,i) => hours[i].toLocaleTimeString().substr(0,8) )
            .attr("style", "font: 10px sans-serif")

    // line & area functions
    line = function(type) {
        return d3.radialLine()
            .defined( (d) => d ) // skip NaN datapoints
            .radius( (d) => radii[type](d[type]) )
            .angle( (d) => a(new Date(d.timestamp)) )
            .curve(d3.curveBasis);
    };
    area = function(type) {
        return d3.radialArea()
            .defined( (d) => d ) // skip NaN datapoints
            .innerRadius(radius/2)
            .outerRadius( (d) => radii[type](d[type]) )
            .angle( (d) => a(new Date(d.timestamp)) )
            .curve(d3.curveBasis);
    };

    // available nodes in db
    $http.get("iocp/nodes")
        .then(function(response) {

            $scope.nodes = response.data;
            $scope.selectedNode = $scope.nodes[0];

            // datapoint types
            return $http.get("iocp/types");

        }).then(function(response) {

            types = response.data;
            $scope.types = types;

            // radial scales for types
            for (k in types) {
                radii[k] = d3.scaleLinear()
                    .domain(types[k].scale)
                    .range([radius/2, radius])
            }

            // angular axis
            ang = 90;
            for (k in types) {

                gr = chart.append("g")
                    .attr("transform", "rotate(" + ang + ")")

                gr.selectAll("g")
                    .data(radii[k].ticks(10))
                    .enter().append("g")
                        .append("text")
                            .attr("y", (d) => -radii[k](d) - 4 )
                            .attr("transform", "rotate(90) translate(5,0)")
                            .attr("style", "font: 10px sans-serif")
                            .text( (d) => d.toFixed(0) );

                gr.append("line")
                    .attr("x1", radius/2)
                    .attr("x2", radius)
                    .attr("style", types[k].linestyle);

                ang += 360/24;

            }

            // current date
            $scope.date = chart.append("text")
                .text($scope.start.toDateString())
                .attr("style", "font: 20px sans-serif; text-anchor:middle;")
                // the coord space is inverted
                .attr("transform", "rotate(180)")

            // line and area fns for types
            lines={}, areas={};
            for (k in types) {
                if (k!="node" & k!="timestamp" & k!="_id") {

                    lines[k] = chart.append("path")
                        .attr("style", types[k].areastyle);

                    areas[k] = chart.append("path")
                        .attr("style", types[k].linestyle);

                }
            }

            // generate plots
            $scope.radialchartUpdate = function() {
                $http.get(
                        "/iocp/range?node="
                        + $scope.selectedNode
                        + "&start=" + $scope.start.toString()
                        + "&end=" + $scope.end.toString()
                    ).then(function(response) {
                        $scope.date.text($scope.start.toDateString())
                        data = response.data;

                        // splice NaN's into dataset
                        // where no datapoints for > 15 minutes
                        for (i=0 ; i<data.length-1 ; i++) {
                            if (new Date(data[i+1].timestamp)-new Date(data[i].timestamp) > (1000*60*15)) {
                                data.splice(i+1, 0, NaN);
                            }
                        }

                        for (k in types) {
                            lines[k].datum(data)
                                // applying when data.length==0
                                // clears previous chart
                                .attr("d", area(k));
                            areas[k].datum(data)
                                .attr("d", line(k))
                        }
                })
            }

            $scope.updateAll = function() {
                $scope.updateLiveView();
                $scope.updateTimeElapsed();
                $scope.radialchartUpdate();
            }

            // update
            // $scope.updateLiveView();
            // $scope.updateTimeElapsed();
            // $scope.radialchartUpdate();
            $scope.updateAll();
            $interval($scope.updateLiveView, 60*1000);
            $interval($scope.updateTimeElapsed, 1000);
            $interval($scope.radialchartUpdate, 60*1000);

      })

})