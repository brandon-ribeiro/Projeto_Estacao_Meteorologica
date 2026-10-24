$(function () {

    var urlBase = "http://127.0.0.1:5000";
    var LIMITE_HISTORICO = 30;

    function diaOuNoite(valor) {
        return valor <= 1500 ? "Dia ☀️" : "Noite 🌙";
    }

    // ---------- Componentes da estação ----------
    var SENSORES = {
        dht22: {
            nome: "DHT22",
            img: "assets/sensores/dht22.svg",
            tensao: "Tensão: 3,3 V a 6 V",
            descricao: "Sensor digital de temperatura e umidade",
            medidas: [
                { campo: "dht_temp", rotulo: "Temperatura", unidade: " °C", casas: 1 },
                { campo: "humidade", rotulo: "Umidade", unidade: " %", casas: 1 }
            ]
        },
        bmp280: {
            nome: "BMP280",
            img: "assets/sensores/bmp280.svg",
            tensao: "Tensão: 1,8 V a 3,6 V",
            descricao: "Sensor de pressão barométrica e temperatura",
            medidas: [
                { campo: "bmp_temp", rotulo: "Temperatura", unidade: " °C", casas: 1 },
                { campo: "pressao", rotulo: "Pressão", unidade: " hPa", casas: 1 }
            ]
        },
        mq135: {
            nome: "MQ135",
            img: "assets/sensores/mq135.svg",
            tensao: "Tensão: 5 V",
            descricao: "Sensor de gases / qualidade do ar",
            medidas: [
                { campo: "mq_value", rotulo: "Qualidade do ar", unidade: " ppm", casas: 0 }
            ]
        },
        ldr: {
            nome: "LDR",
            img: "assets/sensores/ldr.svg",
            tensao: "Tensão: 3,3 V a 5 V",
            descricao: "Sensor de luminosidade (fotoresistor)",
            medidas: [
                { campo: "ldr_value", rotulo: "Luminosidade", unidade: "", casas: 0, extra: diaOuNoite }
            ]
        }
    };

    // Seções da Home: [sensor, campo exibido]
    var GRUPOS = [
        { titulo: "Temperatura", itens: [["dht22", "dht_temp"], ["bmp280", "bmp_temp"]] },
        { titulo: "Pressão", itens: [["bmp280", "pressao"]] },
        { titulo: "Luminosidade", itens: [["ldr", "ldr_value"]] },
        { titulo: "Qualidade do Ar", itens: [["mq135", "mq_value"]] },
        { titulo: "Umidade", itens: [["dht22", "humidade"]] }
    ];

    var ultimaLeitura = null;
    var historico = [];

    function buscarMedida(chave, campo) {
        return SENSORES[chave].medidas.find(function (m) { return m.campo === campo; });
    }

    function formatarValor(medida, leitura) {
        var valor = leitura ? leitura[medida.campo] : null;
        if (valor === null || valor === undefined) {
            return "--";
        }
        return Number(valor).toFixed(medida.casas).replace(".", ",") + medida.unidade;
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

    function corCss(nome) {
        return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    }

    function mostrarErro(msg) {
        $("#erroDados").text(msg).show();
    }

    // ---------- Home ----------
    function montarHome() {
        var pagina = $("#paginaHome").empty();

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
                    .append($("<p>").addClass("componente-extra").attr("data-extra", item[1]))
                    .appendTo(card);
            });

            $("<div>")
                .addClass("grupo")
                .append($("<h3>").addClass("grupo-titulo").text(grupo.titulo))
                .append(card)
                .appendTo(pagina);
        });
    }

    function preencherHome() {
        $.each(GRUPOS, function (i, grupo) {
            $.each(grupo.itens, function (j, item) {
                var medida = buscarMedida(item[0], item[1]);
                $('[data-campo="' + item[1] + '"]').text(formatarValor(medida, ultimaLeitura));
                if (medida.extra && ultimaLeitura) {
                    $('[data-extra="' + item[1] + '"]').text(medida.extra(ultimaLeitura[medida.campo]));
                }
            });
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
    }

    function preencherDetalhe(chave) {
        var sensor = SENSORES[chave];

        $.each(sensor.medidas, function (i, medida) {
            $('[data-spec="' + medida.campo + '"]').text(formatarValor(medida, ultimaLeitura));
            if (medida.extra && ultimaLeitura) {
                $('[data-spec="extra"]').text(medida.extra(ultimaLeitura[medida.campo]));
            }
        });
    }

    function desenharGrafico(chave) {
        var sensor = SENSORES[chave];
        var leituras = historico.slice().reverse();
        var cores = [corCss("--grafico-color"), corCss("--grafico-color-2")];
        var legenda = $("#graficoLegenda").empty();

        var series = $.map(sensor.medidas, function (medida, i) {
            legenda.append(
                $("<span>").css("--cor", cores[i]).text(medida.rotulo + (medida.unidade ? " (" + medida.unidade.trim() + ")" : ""))
            );
            return [{
                data: $.map(leituras, function (l, x) {
                    return l[medida.campo] === null ? null : [[x, l[medida.campo]]];
                }),
                color: cores[i],
                yaxis: i + 1
            }];
        });

        // Mostra no máximo ~6 horários no eixo X
        var passo = Math.max(1, Math.ceil(leituras.length / 6));
        var ticks = $.map(leituras, function (l, x) {
            return x % passo === 0 ? [[x, formatHora(l.data_hora)]] : null;
        });

        $.plot("#grafico", series, {
            series: {
                lines: { show: true, lineWidth: 2 },
                points: { show: leituras.length <= 30, radius: 2 }
            },
            xaxis: { ticks: ticks },
            yaxes: [{}, { position: "right" }],
            grid: {
                borderWidth: 0,
                color: corCss("--tx-muted-color"),
                tickColor: corCss("--grafico-grade")
            }
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

        if (chave) {
            $("#tituloPagina").text(SENSORES[chave].nome);
            $("#paginaHome").prop("hidden", true);
            $("#paginaDetalhe").prop("hidden", false);
            montarDetalhe(chave);
            preencherDetalhe(chave);
            carregarHistorico();
        } else {
            $("#tituloPagina").text("Home");
            $("#paginaDetalhe").prop("hidden", true);
            $("#paginaHome").prop("hidden", false);
            preencherHome();
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
                ultimaLeitura = dados;
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

    function carregarHistorico() {
        var chave = sensorAtual();
        if (!chave) return;

        $.getJSON(urlBase + "/historico", { limite: LIMITE_HISTORICO, tipo: "sensores" })
            .done(function (dados) {
                historico = dados;
                if (sensorAtual() === chave) {
                    desenharGrafico(chave);
                }
            })
            .fail(function () {
                mostrarErro("Não foi possível carregar " + urlBase + "/historico.");
            });
    }

    var temporizador;
    $(window).on("resize", function () {
        clearTimeout(temporizador);
        temporizador = setTimeout(function () {
            var chave = sensorAtual();
            if (chave && historico.length) desenharGrafico(chave);
        }, 200);
    });

    montarHome();
    renderizar();
    carregarDados();

    // Atualiza a cada 10 segundos
    setInterval(function () {
        carregarDados();
        carregarHistorico();
    }, 10000);
});
