$(function () {

    var urlBase = "http://127.0.0.1:5000";

    // LDR: leitura analógica do ESP32 (0 a 4095). Quanto menor o valor, mais claro.
    var MAX_LDR = 4095;
    var LIMITE_DIA = 1500;
    var LUZ_DIA = 100 - LIMITE_DIA / MAX_LDR * 100;

    // Janelas usadas nos gráficos
    var HORAS_SPARKLINE = 3;
    var PONTOS_SPARKLINE = 36;
    var PONTOS_DETALHE = 120;
    var DIAS_COMPARATIVO = 7;

    function diaOuNoite(leitura) {
        return leitura.ldr_value <= LIMITE_DIA ? "Dia ☀️" : "Noite 🌙";
    }

    // Cores dos gráficos: linha + gradiente (topo → base) abaixo dela
    var CORES = {
        temperatura: { linha: "#DC2626", topo: "rgba(220, 38, 38, .45)", base: "rgba(250, 204, 21, .12)" },
        umidade: { linha: "#7C3AED", topo: "rgba(124, 58, 237, .40)", base: "rgba(59, 130, 246, .10)" },
        pressao: { linha: "#0891B2", topo: "rgba(8, 145, 178, .40)", base: "rgba(34, 211, 238, .08)" },
        ar: { linha: "#EA580C", topo: "rgba(234, 88, 12, .40)", base: "rgba(22, 163, 74, .10)" },
        luz: { linha: "#D97706", topo: "rgba(245, 158, 11, .45)", base: "rgba(253, 230, 138, .10)" }
    };

    var VERDE = "#22C55E", AMARELO = "#EAB308", LARANJA = "#F97316", VERMELHO = "#EF4444";

    // Indicadores (gauge) com faixas de cor
    var GAUGES = {
        umidade: {
            titulo: "Umidade relativa", campo: "humidade", min: 0, max: 100, unidade: " %", casas: 0,
            faixas: [
                { ate: 30, rotulo: "Muito seco", cor: VERMELHO },
                { ate: 40, rotulo: "Seco", cor: AMARELO },
                { ate: 60, rotulo: "Agradável", cor: VERDE },
                { ate: 70, rotulo: "Úmido", cor: AMARELO },
                { ate: 100, rotulo: "Muito úmido", cor: LARANJA }
            ]
        },
        ar: {
            // Faixas de referência: ajuste conforme a calibração do MQ135
            titulo: "Qualidade do ar", campo: "mq_value", min: 0, max: 300, unidade: " ppm", casas: 0,
            faixas: [
                { ate: 100, rotulo: "Bom", cor: VERDE },
                { ate: 200, rotulo: "Atenção", cor: AMARELO },
                { ate: 300, rotulo: "Elevado", cor: VERMELHO }
            ]
        },
        luz: {
            titulo: "Luminosidade", campo: "luz_pct", min: 0, max: 100, unidade: " %", casas: 0,
            faixas: [
                { ate: 35, rotulo: "Escuro", cor: "#475569" },
                { ate: LUZ_DIA, rotulo: "Penumbra", cor: "#94A3B8" },
                { ate: 100, rotulo: "Claro", cor: "#FACC15" }
            ]
        },
        pressao: {
            // Pressão medida na estação (não corrigida para o nível do mar).
            // Faixas calculadas para ~760 m de altitude (São Paulo), onde a pressão normal é ~925 hPa:
            // 913 hPa ≈ 1000 hPa no nível do mar (baixa) e 933 hPa ≈ 1022 hPa (alta).
            // Se a estação mudar de altitude, ajuste estes valores.
            titulo: "Pressão atmosférica", campo: "pressao", min: 895, max: 950, unidade: " hPa", casas: 1,
            home: false,
            faixas: [
                { ate: 913, rotulo: "Baixa (chuva)", cor: "#3B82F6" },
                { ate: 933, rotulo: "Normal", cor: VERDE },
                { ate: 950, rotulo: "Alta (tempo firme)", cor: "#F59E0B" }
            ]
        }
    };

    // ---------- Componentes da estação ----------
    var SENSORES = {
        dht22: {
            nome: "DHT22",
            img: "assets/sensores/dht22.svg",
            tensao: "Tensão: 3,3 V a 6 V",
            descricao: "Sensor digital de temperatura e umidade",
            gauge: "umidade",
            medidas: [
                { campo: "dht_temp", rotulo: "Temperatura", unidade: " °C", casas: 1, cor: CORES.temperatura, estavel: 0.2 },
                { campo: "humidade", rotulo: "Umidade", unidade: " %", casas: 1, cor: CORES.umidade, estavel: 1 }
            ]
        },
        bmp280: {
            nome: "BMP280",
            img: "assets/sensores/bmp280.svg",
            tensao: "Tensão: 1,8 V a 3,6 V",
            descricao: "Sensor de pressão barométrica e temperatura",
            gauge: "pressao",
            medidas: [
                { campo: "bmp_temp", rotulo: "Temperatura", unidade: " °C", casas: 1, cor: CORES.temperatura, estavel: 0.2 },
                { campo: "pressao", rotulo: "Pressão", unidade: " hPa", casas: 1, cor: CORES.pressao, estavel: 0.3 }
            ]
        },
        mq135: {
            nome: "MQ135",
            img: "assets/sensores/mq135.svg",
            tensao: "Tensão: 5 V",
            descricao: "Sensor de gases / qualidade do ar",
            gauge: "ar",
            medidas: [
                { campo: "mq_value", rotulo: "Qualidade do ar", unidade: " ppm", casas: 0, cor: CORES.ar, estavel: 5 }
            ]
        },
        ldr: {
            nome: "LDR",
            img: "assets/sensores/ldr.svg",
            tensao: "Tensão: 3,3 V a 5 V",
            descricao: "Sensor de luminosidade (fotoresistor)",
            gauge: "luz",
            medidas: [
                { campo: "luz_pct", rotulo: "Luminosidade", unidade: " %", casas: 0, cor: CORES.luz, estavel: 2, extra: diaOuNoite },
                { campo: "ldr_value", rotulo: "Leitura analógica", unidade: "", casas: 0, cor: CORES.luz, estavel: 50, grafico: false }
            ]
        }
    };

    // Seções da Home: [sensor, campo exibido]
    var GRUPOS = [
        { titulo: "Temperatura", itens: [["dht22", "dht_temp"], ["bmp280", "bmp_temp"]] },
        { titulo: "Pressão", itens: [["bmp280", "pressao"]] },
        { titulo: "Luminosidade", itens: [["ldr", "luz_pct"]] },
        { titulo: "Qualidade do Ar", itens: [["mq135", "mq_value"]] },
        { titulo: "Umidade", itens: [["dht22", "humidade"]] }
    ];

    var ultimaLeitura = null;
    var periodoHome = [];
    var periodoDetalhe = [];
    var resumoDiario = [];
    var horasDetalhe = 24;
    var mediaSelecionada = "humidade_media";

    // ---------- Utilidades ----------
    function enriquecer(leitura) {
        leitura.luz_pct = leitura.ldr_value === null || leitura.ldr_value === undefined
            ? null
            : Math.min(100, Math.max(0, 100 - leitura.ldr_value / MAX_LDR * 100));
        return leitura;
    }

    function buscarMedida(chave, campo) {
        return SENSORES[chave].medidas.find(function (m) { return m.campo === campo; });
    }

    function formatarNumero(valor, casas) {
        return Number(valor).toFixed(casas).replace(".", ",");
    }

    function formatarValor(medida, leitura) {
        var valor = leitura ? leitura[medida.campo] : null;
        if (valor === null || valor === undefined) {
            return "--";
        }
        return formatarNumero(valor, medida.casas) + medida.unidade;
    }

    function formatDate(date) {
        const formatador = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        return formatador.format(new Date(date)).replace(',', '');
    }

    function formatHora(date) {
        return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDia(date) {
        return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    function formatDiaSemana(dia) {
        var data = new Date(dia + "T12:00:00");
        var semana = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace(".", "");
        return semana + " " + formatDia(data);
    }

    function tempo(leitura) {
        return new Date(leitura.data_hora).getTime();
    }

    function corCss(nome) {
        return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    }

    function mostrarErro(msg) {
        $("#erroDados").text(msg).show();
    }

    var contadorIds = 0;
    function novoId(prefixo) {
        contadorIds += 1;
        return prefixo + "-" + contadorIds;
    }

    // ---------- Sparkline (micro-gráfico em SVG) ----------
    function sparklineSvg(valores, cor) {
        valores = valores.filter(function (v) { return v !== null && v !== undefined; });
        if (valores.length < 2) {
            return "";
        }

        var largura = 200, altura = 44, margem = 4;
        var min = Math.min.apply(null, valores);
        var max = Math.max.apply(null, valores);
        var faixa = max - min || 1;

        var pontos = valores.map(function (v, i) {
            var x = i / (valores.length - 1) * largura;
            var y = margem + (1 - (v - min) / faixa) * (altura - margem * 2);
            return x.toFixed(1) + "," + y.toFixed(1);
        });
        var id = novoId("sparkline");

        return '<svg class="sparkline" viewBox="0 0 ' + largura + ' ' + altura + '" preserveAspectRatio="none" aria-hidden="true">' +
            '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + cor.topo + '"/><stop offset="1" stop-color="' + cor.base + '"/>' +
            '</linearGradient></defs>' +
            '<path d="M0,' + altura + ' L' + pontos.join(" L") + ' L' + largura + ',' + altura + ' Z" fill="url(#' + id + ')"/>' +
            '<path d="M' + pontos.join(" L") + '" fill="none" stroke="' + cor.linha + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' +
            '</svg>';
    }

    // Compara o valor atual com o de ~1 hora atrás
    function calcularTendencia(medida) {
        var serie = periodoHome.filter(function (l) { return l[medida.campo] !== null; });
        var atual = ultimaLeitura ? ultimaLeitura[medida.campo] : null;
        if (serie.length < 2 || atual === null || atual === undefined) {
            return null;
        }

        var alvo = tempo(serie[serie.length - 1]) - 3600 * 1000;
        var referencia = serie.find(function (l) { return tempo(l) >= alvo; });
        var umaHora = tempo(serie[0]) <= alvo + 10 * 60 * 1000;
        var diferenca = atual - referencia[medida.campo];
        var periodo = umaHora ? "na última hora" : "desde " + formatHora(referencia.data_hora);

        if (Math.abs(diferenca) < medida.estavel) {
            return { classe: "", texto: "<b>▬ estável</b> " + periodo };
        }
        return {
            classe: diferenca > 0 ? "tendencia-sobe" : "tendencia-desce",
            texto: "<b>" + (diferenca > 0 ? "▲ +" : "▼ −") +
                formatarNumero(Math.abs(diferenca), medida.casas || 1) + medida.unidade + "</b> " + periodo
        };
    }

    // ---------- Gauge (semicírculo com faixas) ----------
    function gaugeSvg(gauge, valor) {
        var cx = 100, cy = 100, raio = 80;

        function fracao(v) {
            return Math.min(1, Math.max(0, (v - gauge.min) / (gauge.max - gauge.min)));
        }
        function ponto(f, r) {
            var angulo = Math.PI * (1 - f);
            return (cx + r * Math.cos(angulo)).toFixed(2) + " " + (cy - r * Math.sin(angulo)).toFixed(2);
        }

        var arcos = "";
        var inicio = gauge.min;
        $.each(gauge.faixas, function (i, faixa) {
            arcos += '<path d="M' + ponto(fracao(inicio), raio) + ' A' + raio + ' ' + raio + ' 0 0 1 ' + ponto(fracao(faixa.ate), raio) +
                '" fill="none" stroke="' + faixa.cor + '" stroke-width="16"/>';
            inicio = faixa.ate;
        });

        var ponteiro = "";
        if (valor !== null && valor !== undefined) {
            ponteiro = '<line class="gauge-ponteiro" x1="' + cx + '" y1="' + cy + '" x2="' + ponto(fracao(valor), raio - 22).replace(" ", '" y2="') +
                '" stroke-width="3" stroke-linecap="round"/>' +
                '<circle class="gauge-ponteiro" cx="' + cx + '" cy="' + cy + '" r="6"/>';
        }

        return '<svg viewBox="0 0 200 122" role="img" aria-label="' + gauge.titulo + '">' + arcos + ponteiro +
            '<text class="gauge-limite" x="20" y="118" text-anchor="middle">' + gauge.min + '</text>' +
            '<text class="gauge-limite" x="180" y="118" text-anchor="middle">' + gauge.max + '</text>' +
            '</svg>';
    }

    function renderizarGauge(container, chave) {
        var gauge = GAUGES[chave];
        var valor = ultimaLeitura ? ultimaLeitura[gauge.campo] : null;
        var faixa = valor === null || valor === undefined ? null : gauge.faixas.find(function (f) { return valor <= f.ate; }) || gauge.faixas[gauge.faixas.length - 1];

        var escala = $("<div>").addClass("gauge-escala");
        $.each(gauge.faixas, function (i, f) {
            escala.append($("<span>").css("--cor", f.cor).text(f.rotulo));
        });

        $(container).empty()
            .append($("<div>").addClass("gauge").html(gaugeSvg(gauge, valor)))
            .append($("<p>").addClass("gauge-valor").text(formatarValor(gauge, ultimaLeitura)))
            .append(faixa ? $("<span>").addClass("gauge-faixa").css("--cor", faixa.cor).text(faixa.rotulo) : null)
            .append(escala);
    }

    // ---------- Gráficos (Flot) ----------
    var tooltip = $("<div>").addClass("tooltip-grafico").appendTo("body").hide();

    function opcoesGrade() {
        return {
            borderWidth: 0,
            hoverable: true,
            color: corCss("--tx-muted-color"),
            tickColor: corCss("--grafico-grade")
        };
    }

    function ativarTooltip(seletor) {
        $(seletor).off("plothover").on("plothover", function (e, pos, item) {
            if (!item) {
                tooltip.hide();
                return;
            }
            tooltip
                .html(item.series.dica(item.dataIndex, item.datapoint[1]))
                .css({ top: item.pageY - 44, left: item.pageX + 10 })
                .show();
        });
    }

    // Escolhe marcações "redondas" no eixo de tempo (ex.: 13:00, 14:00)
    function ticksTempo(axis) {
        var passos = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880];
        var span = (axis.max - axis.min) / 60000;
        var passo = passos.find(function (p) { return span / p <= 7; }) || 2880;
        var passoMs = passo * 60000;
        var fuso = new Date(axis.min).getTimezoneOffset() * 60000;
        var ticks = [];

        for (var t = Math.ceil((axis.min - fuso) / passoMs) * passoMs + fuso; t <= axis.max; t += passoMs) {
            ticks.push([t, passo >= 1440 ? formatDia(t) : formatHora(t)]);
        }
        return ticks;
    }

    function limitesY(valores, margemMinima) {
        var min = Math.min.apply(null, valores);
        var max = Math.max.apply(null, valores);
        var margem = Math.max((max - min) * 0.15, margemMinima);
        return { min: min - margem, max: max + margem };
    }

    function desenharLinha(seletor, medida, leituras) {
        var pontos = $.map(leituras, function (l) {
            return [[tempo(l), l[medida.campo]]];
        });
        var valores = pontos.map(function (p) { return p[1]; }).filter(function (v) { return v !== null; });

        if (!valores.length) {
            $(seletor).html('<p class="grafico-vazio">Sem leituras neste período</p>');
            return null;
        }

        var limites = limitesY(valores, Math.pow(10, -medida.casas));

        // Eixo X sempre cobre a janela escolhida (1 h, 6 h, 24 h, 7 dias)
        var fim = pontos[pontos.length - 1][0];

        $.plot(seletor, [{
            data: pontos,
            color: medida.cor.linha,
            shadowSize: 0,
            lines: { show: true, lineWidth: 2, fill: true, fillColor: { colors: [medida.cor.topo, medida.cor.base] } },
            points: { show: valores.length < 3, radius: 3 },
            dica: function (i, valor) {
                return "<b>" + formatarNumero(valor, medida.casas) + medida.unidade + "</b><br>" + formatDate(pontos[i][0]);
            }
        }], {
            xaxis: { ticks: ticksTempo, min: fim - horasDetalhe * 3600 * 1000, max: fim },
            yaxis: {
                min: limites.min,
                max: limites.max,
                minTickSize: Math.pow(10, -medida.casas),
                tickFormatter: function (v) { return formatarNumero(v, medida.casas); }
            },
            grid: opcoesGrade()
        });
        ativarTooltip(seletor);

        var soma = valores.reduce(function (a, b) { return a + b; }, 0);
        return {
            min: Math.min.apply(null, valores),
            max: Math.max.apply(null, valores),
            media: soma / valores.length
        };
    }

    function desenharBarras() {
        if ($("#paginaHome").prop("hidden")) return;

        var dias = $.map(resumoDiario, function (d, i) { return [[i, formatDiaSemana(d.dia)]]; });
        // Mantém no mínimo 5 posições para as barras não ficarem largas com poucos dias
        var sobra = Math.max(0, 5 - resumoDiario.length) / 2;
        var eixoX = { ticks: dias, min: -0.6 - sobra, max: resumoDiario.length - 0.4 + sobra };
        var vazio = '<p class="grafico-vazio">Sem leituras ainda</p>';

        // Temperatura mínima x máxima
        var azul = "#3B82F6", vermelho = "#EF4444";
        $("#legendaMinMax").empty()
            .append($("<span>").css("--cor", azul).text("Mínima (°C)"))
            .append($("<span>").css("--cor", vermelho).text("Máxima (°C)"));

        var temps = resumoDiario.filter(function (d) { return d.temp_min !== null; });
        if (!temps.length) {
            $("#graficoMinMax").html(vazio);
        } else {
            var menor = Math.min.apply(null, temps.map(function (d) { return d.temp_min; }));
            var maior = Math.max.apply(null, temps.map(function (d) { return d.temp_max; }));

            $.plot("#graficoMinMax", [
                serieBarras("temp_min", -0.19, azul, "Mínima", " °C", 1),
                serieBarras("temp_max", 0.19, vermelho, "Máxima", " °C", 1)
            ], {
                xaxis: eixoX,
                yaxis: { min: Math.min(0, Math.floor(menor - 2)), max: Math.ceil(maior + 2) },
                grid: opcoesGrade()
            });
            ativarTooltip("#graficoMinMax");
        }

        // Médias diárias (umidade ou pressão)
        var umidade = mediaSelecionada === "humidade_media";
        var cor = umidade ? CORES.umidade.linha : CORES.pressao.linha;
        var unidade = umidade ? " %" : " hPa";
        $("#legendaMedias").empty()
            .append($("<span>").css("--cor", cor).text((umidade ? "Umidade" : "Pressão") + " média (" + unidade.trim() + ")"));

        var medias = resumoDiario.map(function (d) { return d[mediaSelecionada]; }).filter(function (v) { return v !== null; });
        if (!medias.length) {
            $("#graficoMedias").html(vazio);
            return;
        }

        var eixoY = umidade ? { min: 0, max: 100 } : limitesY(medias, 1);
        $.plot("#graficoMedias", [
            serieBarras(mediaSelecionada, 0, cor, "Média", unidade, 1, 0.5)
        ], {
            xaxis: eixoX,
            yaxis: eixoY,
            grid: opcoesGrade()
        });
        ativarTooltip("#graficoMedias");
    }

    function serieBarras(campo, deslocamento, cor, rotulo, unidade, casas, largura) {
        return {
            data: $.map(resumoDiario, function (d, i) { return [[i + deslocamento, d[campo]]]; }),
            color: cor,
            shadowSize: 0,
            bars: { show: true, barWidth: largura || 0.36, align: "center", lineWidth: 0, fill: 0.85 },
            dica: function (i, valor) {
                return formatDiaSemana(resumoDiario[i].dia) + "<br>" + rotulo + ": <b>" + formatarNumero(valor, casas) + unidade + "</b>";
            }
        };
    }

    // ---------- Home ----------
    function montarHome() {
        var grade = $("#homeGrupos").empty();

        $.each(GRUPOS, function (i, grupo) {
            var card = $("<div>").addClass("grupo-card");

            $.each(grupo.itens, function (j, item) {
                var sensor = SENSORES[item[0]];
                $("<a>")
                    .addClass("componente")
                    .attr({ href: "#" + item[0], title: "Ver detalhes do " + sensor.nome })
                    .append($("<img>").addClass("componente-img").attr({ src: sensor.img, alt: sensor.nome }))
                    .append($("<p>").addClass("componente-nome").text(sensor.nome))
                    .append($("<p>").addClass("componente-dado").attr("data-campo", item[1]).text("--"))
                    .append($("<p>").addClass("tendencia").attr("data-tendencia", item[1]))
                    .append($("<p>").addClass("componente-extra").attr("data-extra", item[1]))
                    .append($("<div>").attr("data-sparkline", item[0] + "-" + item[1]))
                    .appendTo(card);
            });

            $("<div>")
                .addClass("grupo")
                .append($("<h4>").addClass("grupo-titulo").text(grupo.titulo))
                .append(card)
                .appendTo(grade);
        });

        var gauges = $("#homeGauges").empty();
        $.each(GAUGES, function (chave, gauge) {
            if (gauge.home === false) return;
            $("<div>")
                .addClass("grupo")
                .append($("<h4>").addClass("grupo-titulo").text(gauge.titulo))
                .append($("<div>").addClass("grupo-card gauge-card").attr("data-gauge", chave))
                .appendTo(gauges);
        });
    }

    function preencherHome() {
        $.each(GRUPOS, function (i, grupo) {
            $.each(grupo.itens, function (j, item) {
                var medida = buscarMedida(item[0], item[1]);
                var tendencia = calcularTendencia(medida);

                $('[data-campo="' + item[1] + '"]').text(formatarValor(medida, ultimaLeitura));
                $('[data-tendencia="' + item[1] + '"]')
                    .removeClass("tendencia-sobe tendencia-desce")
                    .addClass(tendencia ? tendencia.classe : "")
                    .html(tendencia ? tendencia.texto : "");
                if (medida.extra && ultimaLeitura) {
                    $('[data-extra="' + item[1] + '"]').text(medida.extra(ultimaLeitura));
                }
                $('[data-sparkline="' + item[0] + "-" + item[1] + '"]').html(
                    sparklineSvg(periodoHome.map(function (l) { return l[item[1]]; }), medida.cor)
                );
            });
        });

        $("[data-gauge]").each(function () {
            renderizarGauge(this, $(this).attr("data-gauge"));
        });
    }

    // ---------- Detalhe do componente ----------
    function montarDetalhe(chave) {
        var sensor = SENSORES[chave];

        $("#specImg").attr({ src: sensor.img, alt: sensor.nome });
        $("#specNome").text(sensor.nome);
        $("#specTensao").text(sensor.tensao);
        $("#specDescricao").text(sensor.descricao);

        var lista = $("#specMedidas").empty();
        $.each(sensor.medidas, function (i, medida) {
            lista.append($("<dt>").text(medida.rotulo));
            lista.append($("<dd>").attr("data-spec", medida.campo).text("--"));
        });
        if (sensor.medidas[0].extra) {
            lista.append($("<dt>").text("Período"));
            lista.append($("<dd>").attr("data-spec", "extra").text("--"));
        }

        var graficos = $("#graficosDetalhe").empty();
        $.each(sensor.medidas, function (i, medida) {
            if (medida.grafico === false) return;
            $("<div>")
                .addClass("grafico-card")
                .append(
                    $("<div>").addClass("grafico-topo")
                        .append($("<div>").addClass("grafico-legenda")
                            .append($("<span>").css("--cor", medida.cor.linha).text(medida.rotulo + (medida.unidade ? " (" + medida.unidade.trim() + ")" : ""))))
                        .append($("<p>").addClass("grafico-resumo").attr("id", "resumo-" + medida.campo))
                )
                .append($("<div>").addClass("grafico").attr("id", "grafico-" + medida.campo))
                .appendTo(graficos);
        });
    }

    function preencherDetalhe(chave) {
        var sensor = SENSORES[chave];

        $.each(sensor.medidas, function (i, medida) {
            $('[data-spec="' + medida.campo + '"]').text(formatarValor(medida, ultimaLeitura));
            if (medida.extra && ultimaLeitura) {
                $('[data-spec="extra"]').text(medida.extra(ultimaLeitura));
            }
        });

        if (sensor.gauge) {
            renderizarGauge("#specGauge", sensor.gauge);
        } else {
            $("#specGauge").empty();
        }
    }

    function desenharGraficosDetalhe(chave) {
        $.each(SENSORES[chave].medidas, function (i, medida) {
            if (medida.grafico === false) return;

            var resumo = desenharLinha("#grafico-" + medida.campo, medida, periodoDetalhe);
            $("#resumo-" + medida.campo).text(resumo
                ? "mín " + formatarNumero(resumo.min, medida.casas) +
                  " · máx " + formatarNumero(resumo.max, medida.casas) +
                  " · média " + formatarNumero(resumo.media, medida.casas) + medida.unidade
                : "");
        });
    }

    // ---------- Navegação (#home, #dht22, ...) ----------
    function sensorAtual() {
        var chave = location.hash.replace("#", "");
        return SENSORES[chave] ? chave : null;
    }

    function renderizar() {
        var chave = sensorAtual();

        $("#filtroMenu a").removeClass("ativo")
            .filter('[href="#' + (chave || "home") + '"]').addClass("ativo");
        fecharFiltro();
        tooltip.hide();

        if (chave) {
            $("#tituloPagina").text(SENSORES[chave].nome);
            $("#paginaHome").prop("hidden", true);
            $("#paginaDetalhe").prop("hidden", false);
            montarDetalhe(chave);
            preencherDetalhe(chave);
            carregarDetalhe();
        } else {
            $("#tituloPagina").text("Home");
            $("#paginaDetalhe").prop("hidden", true);
            $("#paginaHome").prop("hidden", false);
            preencherHome();
            carregarHome();
        }
        window.scrollTo(0, 0);
    }

    function fecharFiltro() {
        $("#filtroMenu").removeClass("aberto");
        $("#filtroBotao").attr("aria-expanded", "false");
    }

    $("#filtroBotao").on("click", function (e) {
        e.stopPropagation();
        var aberto = $("#filtroMenu").toggleClass("aberto").hasClass("aberto");
        $(this).attr("aria-expanded", String(aberto));
    });

    $(document).on("click", fecharFiltro);
    $(document).on("keydown", function (e) {
        if (e.key === "Escape") fecharFiltro();
    });
    $(window).on("hashchange", renderizar);

    $("#seletorPeriodo").on("click", "button", function () {
        $(this).addClass("ativo").siblings().removeClass("ativo");
        horasDetalhe = Number($(this).attr("data-horas"));
        carregarDetalhe();
    });

    $("#seletorMedia").on("click", "button", function () {
        $(this).addClass("ativo").siblings().removeClass("ativo");
        mediaSelecionada = $(this).attr("data-media");
        desenharBarras();
    });

    // ---------- Requisições ----------
    function atualizarStatus(online) {
        $("#statusBolinha").toggleClass("offline", !online);
        if (!online) {
            $("#statusHeader").text("Offline");
            return;
        }
        if (ultimaLeitura.city) {
            $("#local").text(ultimaLeitura.city + (ultimaLeitura.state ? " - " + ultimaLeitura.state : ""));
        }
        $("#statusHeader").text("Online • " + formatDate(ultimaLeitura.data_hora));
    }

    function carregarDados() {
        $.getJSON(urlBase + "/dados")
            .done(function (dados) {
                $("#erroDados").hide();
                ultimaLeitura = enriquecer(dados);
                atualizarStatus(true);

                var chave = sensorAtual();
                if (chave) {
                    preencherDetalhe(chave);
                } else {
                    preencherHome();
                }
            })
            .fail(function (xhr) {
                atualizarStatus(false);
                if (xhr.status === 404) {
                    mostrarErro("Nenhuma leitura de sensores recebida ainda.");
                } else {
                    mostrarErro("Não foi possível carregar " + urlBase + "/dados. O Flask está rodando?");
                }
            });
    }

    function carregarHome() {
        $.getJSON(urlBase + "/historico/periodo", { horas: HORAS_SPARKLINE, pontos: PONTOS_SPARKLINE })
            .done(function (dados) {
                periodoHome = dados.map(enriquecer);
                if (!sensorAtual()) preencherHome();
            })
            .fail(function () {
                mostrarErro("Não foi possível carregar " + urlBase + "/historico/periodo. Reinicie o app.py para carregar as rotas novas.");
            });

        $.getJSON(urlBase + "/resumo/diario", { dias: DIAS_COMPARATIVO })
            .done(function (dados) {
                resumoDiario = dados;
                desenharBarras();
            })
            .fail(function () {
                mostrarErro("Não foi possível carregar " + urlBase + "/resumo/diario. Reinicie o app.py para carregar as rotas novas.");
                $("#graficoMinMax, #graficoMedias").html('<p class="grafico-vazio">Não foi possível carregar o comparativo</p>');
            });
    }

    function carregarDetalhe() {
        var chave = sensorAtual();
        if (!chave) return;

        $.getJSON(urlBase + "/historico/periodo", { horas: horasDetalhe, pontos: PONTOS_DETALHE })
            .done(function (dados) {
                periodoDetalhe = dados.map(enriquecer);
                if (sensorAtual() === chave) {
                    desenharGraficosDetalhe(chave);
                }
            })
            .fail(function () {
                mostrarErro("Não foi possível carregar " + urlBase + "/historico/periodo. Reinicie o app.py para carregar as rotas novas.");
                $("#graficosDetalhe .grafico").html('<p class="grafico-vazio">Não foi possível carregar o histórico</p>');
            });
    }

    function redesenharGraficos() {
        var chave = sensorAtual();
        if (chave) {
            if (periodoDetalhe.length) desenharGraficosDetalhe(chave);
        } else {
            desenharBarras();
        }
    }

    var temporizador;
    $(window).on("resize", function () {
        clearTimeout(temporizador);
        temporizador = setTimeout(redesenharGraficos, 200);
    });

    // ---------- Modo claro / escuro ----------
    function aplicarTema(tema, salvar) {
        document.documentElement.setAttribute("data-theme", tema);
        $("#temaBotao").attr("aria-pressed", String(tema === "dark"));
        if (salvar) {
            try { localStorage.setItem("tema", tema); } catch (e) {}
        }
        // Os gráficos do Flot são desenhados em canvas: precisam ser refeitos com as novas cores
        redesenharGraficos();
    }

    $("#temaBotao").on("click", function () {
        var atual = document.documentElement.getAttribute("data-theme");
        aplicarTema(atual === "dark" ? "light" : "dark", true);
    });

    // Sem escolha salva, acompanha a mudança de tema do sistema
    var temaSistema = window.matchMedia("(prefers-color-scheme: dark)");
    $(temaSistema).on("change", function () {
        var salvo = null;
        try { salvo = localStorage.getItem("tema"); } catch (e) {}
        if (!salvo) aplicarTema(temaSistema.matches ? "dark" : "light", false);
    });
    $("#temaBotao").attr("aria-pressed", String(document.documentElement.getAttribute("data-theme") === "dark"));

    montarHome();
    renderizar();
    carregarDados();

    // Atualiza a cada 10 segundos
    setInterval(function () {
        carregarDados();
        if (sensorAtual()) {
            carregarDetalhe();
        } else {
            carregarHome();
        }
    }, 10000);
});
