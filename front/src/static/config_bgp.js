const ConfigBgp = function (currentDevice) {
    var modalId = 'BgpConfigModal' + currentDevice.data.id;
    var tableId = 'BgpConfigTable' + currentDevice.data.id;

    $('#' + modalId).remove();

    var buttonElem = document.getElementById('config_button_bgp_script');
    var modalElem = document.getElementById('config_modal_bgp_script');
    var tableElem = document.getElementById('config_table_bgp_script');

    if (!buttonElem || !modalElem || !tableElem) {
        return;
    }

    var buttonHTML = buttonElem.innerHTML;
    var modalHTML = modalElem.innerHTML;
    var tableHTML = tableElem.innerHTML;

    modalHTML = modalHTML.replace('id="BgpModal"', 'id="' + modalId + '"');
    tableHTML = tableHTML.replace('id="config_table_bgp"', 'id="' + tableId + '"');

    var buttonElem = $(buttonHTML).insertAfter('#config_router_name');
    buttonElem.attr('data-bs-target', '#' + modalId);

    var modalElem = $(modalHTML).appendTo('body');
    var tableElem = $(tableHTML).appendTo('#' + modalId + ' .modal-body').hide();

    $(document).ready(function () {
        $('[data-bs-toggle="tooltip"]').tooltip();
        setupBgpEventHandlers(currentDevice, modalId, tableId);
    });
}

function setupBgpEventHandlers(currentDevice, modalId, tableId) {
    if (!currentDevice.config) {
        currentDevice.config = {};
    }

    $('#' + modalId).find('#config_bgp_switch').off('click').on('click', function () {
        if ($(this).is(':checked')) {
            $('#' + tableId).show();
            if (!currentDevice.config.bgp) {
                currentDevice.config.bgp = {
                    local_asn: "",
                    router_id: "",
                    networks: [],
                    neighbors: []
                };
            }
            populateBgpFields(currentDevice, tableId);
        } else {
            currentDevice.config.bgp = null;
            $('#' + tableId).hide();
            clearBgpFields(tableId);
        }
    });

    $('#' + modalId).find('#bgpConfigurationCancelIcon, #bgpConfigurationSubmit').on('click', function () {
        $('#' + modalId).modal('hide');
    });

    $('#' + modalId).on('hidden.bs.modal', function () {
        updateBgpButtonStyle(currentDevice);
        SetNetworkPlayerState(-1);
        DrawGraph();
        PostNodesEdges();
    });

    $('#config_button_bgp').off('click').on('click', function () {
        if (isBgpEnabled(currentDevice)) {
            $('#' + modalId).find('#config_bgp_switch').prop('checked', true);
            $('#' + tableId).show();
            populateBgpFields(currentDevice, tableId);
        } else {
            $('#' + modalId).find('#config_bgp_switch').prop('checked', false);
            $('#' + tableId).hide();
        }
        $('#' + modalId).modal('show');
    });

    $('#' + tableId).find('.bgp-local-as').on('input', function() {
        if (currentDevice.config.bgp) currentDevice.config.bgp.local_asn = $(this).val();
    });
    $('#' + tableId).find('.bgp-router-id').on('input', function() {
        if (currentDevice.config.bgp) currentDevice.config.bgp.router_id = $(this).val();
    });

    $('#' + tableId).find('.add-bgp-network').off('click').on('click', function () {
        addBgpNetwork(currentDevice, tableId, modalId);
    });

    $('#' + tableId).find('.add-bgp-neighbor').off('click').on('click', function () {
        addBgpNeighbor(currentDevice, tableId, modalId);
    });

    updateBgpButtonStyle(currentDevice);
}

function populateBgpFields(currentDevice, tableId) {
    if (!currentDevice.config.bgp) return;

    $('#' + tableId).find('.bgp-local-as').val(currentDevice.config.bgp.local_asn || '');
    $('#' + tableId).find('.bgp-router-id').val(currentDevice.config.bgp.router_id || '');
    
    generateNetworksContent(currentDevice, tableId);
    generateNeighborsContent(currentDevice, tableId);
}

function generateNetworksContent(currentDevice, tableId) {
    const list = $('#' + tableId).find('.bgp-networks-list')[0];
    list.innerHTML = '';
    
    if (!currentDevice.config.bgp || !currentDevice.config.bgp.networks) return;

    currentDevice.config.bgp.networks.forEach((net, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.textContent = `Подсеть: ${net}`;
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-danger btn-sm';
        btn.textContent = 'Удалить';
        btn.onclick = () => {
            currentDevice.config.bgp.networks.splice(index, 1);
            generateNetworksContent(currentDevice, tableId);
        };
        
        li.appendChild(btn);
        list.appendChild(li);
    });
}

function generateNeighborsContent(currentDevice, tableId) {
    const list = $('#' + tableId).find('.bgp-neighbors-list')[0];
    list.innerHTML = ''; 
    
    if (!currentDevice.config.bgp || !currentDevice.config.bgp.neighbors) return;

    currentDevice.config.bgp.neighbors.forEach((nb, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        let text = `IP: ${nb.ip}, AS: ${nb.remote_as}`;
        if (nb.weight !== null && nb.weight !== undefined && nb.weight !== "") {
            text += `, Weight: ${nb.weight}`;
        }
        li.textContent = text;
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-danger btn-sm';
        btn.textContent = 'Удалить';
        btn.onclick = () => {
            currentDevice.config.bgp.neighbors.splice(index, 1);
            generateNeighborsContent(currentDevice, tableId);
        };
        
        li.appendChild(btn);
        list.appendChild(li);
    });
}

function addBgpNetwork(currentDevice, tableId, modalId) {
    const netInput = $('#' + tableId).find('.bgp-network-input').val().trim();

    if (!netInput || !netInput.includes('/')) {
        showBgpAlert("Неверный формат сети. Используйте CIDR, например 192.168.1.0/24", "danger", modalId);
        return;
    }

    if (currentDevice.config.bgp.networks.includes(netInput)) {
        showBgpAlert("Эта сеть уже добавлена.", "warning", modalId);
        return;
    }

    currentDevice.config.bgp.networks.push(netInput);
    $('#' + tableId).find('.bgp-network-input').val('');
    generateNetworksContent(currentDevice, tableId);
}

function addBgpNeighbor(currentDevice, tableId, modalId) {
    const ip = $('#' + tableId).find('.bgp-neighbor-ip').val().trim();
    const as = $('#' + tableId).find('.bgp-neighbor-as').val().trim();
    const weight = $('#' + tableId).find('.bgp-neighbor-weight').val().trim();

    if (!isValidIPv4(ip)) {
        showBgpAlert("Неверный IP-адрес соседа.", "danger", modalId);
        return;
    }

    if (!as || isNaN(as) || Number(as) < 1 || Number(as) > 4294967295) {
        showBgpAlert("Неверный Remote AS.", "danger", modalId);
        return;
    }

    const duplicate = currentDevice.config.bgp.neighbors.find(n => n.ip === ip);
    if (duplicate) {
        showBgpAlert("Сосед с таким IP уже существует.", "warning", modalId);
        return;
    }

    currentDevice.config.bgp.neighbors.push({
        ip: ip,
        remote_as: as,
        weight: weight ? Number(weight) : null
    });

    $('#' + tableId).find('.bgp-neighbor-ip').val('');
    $('#' + tableId).find('.bgp-neighbor-as').val('');
    $('#' + tableId).find('.bgp-neighbor-weight').val('');
    
    generateNeighborsContent(currentDevice, tableId);
}

function isBgpEnabled(currentDevice) {
    return currentDevice.config && currentDevice.config.bgp !== null && currentDevice.config.bgp !== undefined;
}

function updateBgpButtonStyle(currentDevice) {
    if (isBgpEnabled(currentDevice)) {
        $('#config_button_bgp').addClass('btn-outline-primary').removeClass('btn-outline-secondary');
    } else {
        $('#config_button_bgp').removeClass('btn-outline-primary').addClass('btn-outline-secondary');
    }
}

function clearBgpFields(tableId) {
    $('#' + tableId).find('input').val('');
}

function isValidIPv4(ip) {
    const ipv4Regex = /^(25[0-5]|2[0-4]\d|[0-1]?\d{1,2})(\.(25[0-5]|2[0-4]\d|[0-1]?\d{1,2})){3}$/;
    return ipv4Regex.test(ip);
}

function showBgpAlert(message, type = 'info', modalId) {
    const alertContainer = $('#' + modalId + ' .bgpAlertContainer');
    const alertId = `alert-${Date.now()}`;

    const alertHTML = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Закрыть"></button>
        </div>
    `;

    alertContainer.append(alertHTML);

    setTimeout(() => {
        $(`#${alertId}`).alert('close');
    }, 5000);
}