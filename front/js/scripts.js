$(function () {

    var urlBase = "http://127.0.0.1:5000";

    function mostrarErro(msg) {
        $("#erroDados").text(msg).show();
    }

    // ---------- Requisições ----------
    function carregarDados() {
        $.getJSON(urlBase + "/dados")
            .done(function (dados) {
                $("#erroDados").hide();
                preencherEstacao(dados);
                preencherCards(dados);
                graficoDados = dados;
            })
            .fail(function () {
                mostrarErro("Nao foi possivel carregar " + urlBase + "/dados. O Flask esta rodando?");
            });
    }

    function carregarHistorico() {
        $.getJSON(urlBase + "/historico")
            .done(function (historico) {
                preencherHistorico(historico);
            })
            .fail(function () {
                mostrarErro("Nao foi possivel carregar " + urlBase + "/historico.");
            });
    }

    carregarDados();
    carregarHistorico();

    // Atualiza a cada 10 segundos (ajuste se quiser)
    setInterval(function () {
        carregarDados();
        carregarHistorico();
    }, 10000);

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
        let data = new Date(date);
        let dataFormatada = formatador.format(data).replace(',', '');

        return dataFormatada
    }

    function preencherEstacao(estacao) {
        $("#status, #statusHeader").text("Online");
        $("#gps").text(
            estacao.ip_lat.toFixed(4) + ", " + estacao.ip_lon.toFixed(4)
        );
    }

    function atualizarDataHora() {
        let agora = new Date();
        $("#dataHora").text(formatDate(agora));
    }

    atualizarDataHora();
    setInterval(atualizarDataHora, 1000);

    function preencherCards(cards) {
        $("#bmp_press").text(cards.bmp_press.toFixed(2));
        $("#dht_temp").text(cards.dht_temp.toFixed(0) + "°");
        $("#dht_hum").text(cards.dht_hum.toFixed(0) + "%");
    }

    var temporizador;
    $(window).on("resize", function () {
        clearTimeout(temporizador);
    });

    function preencherHistorico(historico) {
        let corpo = $(".tabela-historico tbody").empty();
        $.each(historico, function (i, leitura) {
            let ldrValue = leitura.ldr <= 1500 ? "Dia ☀️" : "Noite 🌙";
            $("<tr>")
                .append($("<td>").text(leitura.ip_lat + ", " + leitura.ip_lon))
                .append($("<td>").text(formatDate(leitura.data_hora)))
                .append($("<td>").text(leitura.dht_temp.toFixed(0) + "°"))
                .append($("<td>").text(leitura.dht_hum.toFixed(0) + "%"))
                .append($("<td>").text(leitura.bmp_press.toFixed(2)))
                .append($("<td>").text(leitura.qualidadeAr))
                .append($("<td>").text(ldrValue))
                .appendTo(corpo);
        });
    }
});
