var app = angular.module("app", []);

app.controller("main", function($scope, $http, $interval) {

    // most recent datapoint
    updateLiveView = function() {
        $http.get("/iocp/current")
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
    updateTimeElapsed = function() {
        $scope.timeelapsed = new Date(new Date() - $scope.timestamp);
    };

    $scope.start = new Date(new Date().setUTCHours(0,0,0,0));
    $scope.end = new Date(new Date().setUTCHours(23,59,59,999));
    $scope.daysadd = function(sdt, edt, i) {
        sdt.setDate(sdt.getDate()+i);
        edt.setDate(edt.getDate()+i);
        linechartUpdate();
    };
    $scope.monthsadd = function(sdt, edt, i) {
        sdt.setMonth(sdt.getMonth()+i);
        edt.setMonth(edt.getMonth()+i);
        linechartUpdate();
    };


    // draw lines and time axis
    linechartUpdate = function() {
        $http.get("/iocp/range?start=" + $scope.start.toISOString() + "&end=" + $scope.end.toISOString())
            .then(function(response) {

            // clear chart content
            chart.selectAll("*").remove();

            data = response.data;

            // x (time) scale
            xscale = d3.scaleTime()
                .domain([$scope.start, $scope.end])
                .range([0, width]);

            chart.append("g")
                .call(d3.axisBottom(xscale))
                .attr("transform", "translate(0," + (height) + ")");

            svg.append("text")
                .attr("x", (width+margin.left+margin.right)/2)
                .attr("y", height+margin.top+margin.bottom)
                .attr("text-anchor", "middle")
                .text("Date Time");

            // scale point fns
            x = (d) => xscale(new Date(d.timestamp));
            yt = (d) => ytscale(d.t);
            yh = (d) => yhscale(d.h);
            yl = (d) => ylscale(d.l);

            // temperature
            templine = d3.line()
                .x( x )
                .y( yt )
                .curve(d3.curveBasis);

            chart.append("path")
                .datum(data)
                .attr("d", templine)
                .attr("style", $scope.types["t"].linestyle);

            // humidity
            humidityline = d3.line()
                .x( x )
                .y( yh )
                .curve(d3.curveBasis);

            chart.append("path")
                .datum(data)
                .attr("d", humidityline)
                .attr("style", $scope.types["h"].linestyle);

            // luminance
            luminanceline = d3.line()
                .x( x )
                .y( yl )
                .curve(d3.curveBasis);

            chart.append("path")
                .datum(data)
                .attr("d", luminanceline)
                .attr("style", $scope.types["l"].linestyle);

        });
    };

    $http.get("/iocp/nodes")
        .then(function(response) {
            $scope.nodes = response.data;
            $scope.selectedNode = $scope.nodes[0];
            // TODO: return $http.get("/iocp/types?" + $scope.selectedNode)
            return $http.get("/iocp/types")
        })
        .then(function(response) {
            $scope.types = response.data;
        })
        .then(function() {
            updateLiveView();
            updateTimeElapsed();
            $interval( updateLiveView, 60*1000)
            $interval( updateTimeElapsed, 1000)

            // chart setup
            margin = {top: 10, right: 50, bottom: 50, left: 50};
            width = 900 - margin.right - margin.left;
            height = 400 - margin.top - margin.bottom;

            svg = d3.select("#graph")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom);

            chart = svg.append("g")
                .attr("transform", "translate(" + margin.left + ", " + margin.top +")" )
                .attr("width", width)
                .attr("height", height);

            // y scales
            ytscale = d3.scaleLinear()
                .domain([20, 80])
                .range([height, 0]); // invert y scale

            yhscale = d3.scaleLinear()
                .domain([0, 100])
                .range([height, 0]); // invert y scale

            ylscale = d3.scaleLinear()
                .domain([0, 65535])
                .range([height, 0]);

            // temp axis & label
            svg.append("g")
                .call(d3.axisLeft(ytscale))
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            svg.append("text")
                .attr("transform", "rotate(-90)")
                // coord system reversed due rotation
                .attr("x", -height/2)
                .attr("y", 0)
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .text("Temperature (" + $scope.types["t"].unit + ")");

            // luminance axis & label
            svg.append("g")
                .call(d3.axisRight(yhscale))
                .attr("transform", "translate(" + (width + margin.right) + "," + margin.top + ")");

            svg.append("text")
                .attr("transform", "rotate(-90)")
                // coord system reversed due rotation
                .attr("x", 0-(height/2))
                .attr("y", width+margin.left+margin.right)
                .attr("dy", "-1em")
                .style("text-anchor", "middle")
                .text("Humidity (" + $scope.types["h"].unit+ ")");

            linechartUpdate();
        });

});
