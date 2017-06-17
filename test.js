var app = angular.module("app", []);

app.controller("main", function($scope, $http, $interval) {

    node = "esp8266:18:fe:34:e1:1d:8b";

    today = d3.timeDay.floor(new Date());
    start = d3.timeMonth.floor(today);
    end = d3.timeSecond.offset(d3.timeMonth.offset(start, 1), -1);
    monthdays = d3.timeDay.offset(end, -1).getDate();

    width = 900;
    height = 50;
    margin = {left:15, right:15, top:15, bottom:30};

    canvas = d3.select("#summary")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    chart = canvas.append("g")
            .attr(
                "transform", "translate("
                + margin.left + ","
                + margin.top + ")"
            );

    x = d3.scaleTime()
        .domain([start, end])
        .range([0, width]);

    y = d3.scaleLinear()
        .range([height, 0]);

    canvas.append("g")
        .call(
            d3.axisBottom(x)
                .ticks(monthdays)
                .tickFormat(d3.timeFormat("%d"))
        )
        .attr("transform", "translate(" + margin.left + "," + (height + margin.top) + ")");

    line = function(datapoint) {
        return d3.line()
            // skip plotting where no data
            .defined( (d) => d )
            .x( (d) => x(new Date(d._id.year, d._id.month-1, d._id.day, d._id.hour,0,0,0)))
            .y( (d) => y(d[datapoint]))
            .curve(d3.curveBasis);
    };

    brush = d3.brushX()
        .extent([[0,0], [width, height]])
        .on("end",
            function(){
                if (!d3.event.sourceEvent || !d3.event.selection) return;
                d = [d3.timeDay.round(
                        x.invert(d3.event.selection[0])
                )];
                d[1] = d3.timeDay.offset(d[0], 1);
                d3.select(this)
                    .transition()
                        .call(d3.event.target.move, d.map(x))
            }
        );

    viewport = chart.append("g")
        .attr("class", "viewport")
        .call(brush)
        .call(
            brush.move,
            [x(today), x(d3.timeDay.offset(today, 1))]
        );

    $http.get("iocp/types")
        .then (function(response) {

            types = response.data;

            return $http.get(
                "iocp/summary"
                + "?node=" + node
                + "&year=" + start.getFullYear()
                + "&month=" + (start.getMonth()+1)
            );

        }).then(function(response){

            data = response.data;

            // splice NaN's into gaps in dataset
            // where delta _id > 1 hour
            id2int = (_id) => (_id.day*24)+(_id.hour);
            for (i=0 ; i<data.length-1 ; i++) {
                if ( id2int(data[i+1]._id) - id2int(data[i]._id) > 1 ) {
                    data.splice(i+1, 0, NaN)
                    i += 1;
                }
            };

            for (k in types) {

                // y scale to current type domain
                y.domain(types[k].scale);

                chart.append("path")
                    .datum(data)
                    .attr("d", line(k))
                    .attr("style", types[k].linestyle)

            };

        });



})