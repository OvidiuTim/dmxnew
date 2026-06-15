// Dropdown Predare / Primire
function toggleDropdown() {

    const dropdown =
        document.getElementById("equipmentDropdown");

    dropdown.classList.toggle("show");
}



// Switch tabs
function showTab(tabName, clickedTab) {

    document.querySelectorAll('.tab')
        .forEach(tab => {
            tab.classList.remove('active');
        });

    clickedTab.classList.add('active');

    document.querySelectorAll('.tab-content')
        .forEach(content => {
            content.classList.remove('active');
        });

    document
        .getElementById(tabName + '-content')
        .classList.add('active');
}



// Dropdown Actiuni
function toggleToolMenu(button) {

    const currentMenu =
        button.parentElement.querySelector('.tool-menu');

    document.querySelectorAll('.tool-menu').forEach(menu => {

        if (menu !== currentMenu) {
            menu.classList.remove('show');
            menu.classList.remove('open-up');
        }

    });

    currentMenu.classList.remove('open-up');

    const rect = button.getBoundingClientRect();

    if (window.innerHeight - rect.bottom < 180) {
        currentMenu.classList.add('open-up');
    }

    currentMenu.classList.toggle('show');
}



// Close dropdowns
window.addEventListener("click", function (e) {

    // Close dropdown Predare / Primire
    const dropdown =
        document.getElementById("equipmentDropdown");

    const button =
        document.querySelector(".dropdown-btn");

    if (
        dropdown &&
        button &&
        !button.contains(e.target) &&
        !dropdown.contains(e.target)
    ) {
        dropdown.classList.remove("show");
    }

    // Close dropdown Actiuni
    if (
        !e.target.closest('.action-btn') &&
        !e.target.closest('.tool-menu')
    ) {

        document
            .querySelectorAll('.tool-menu')
            .forEach(menu => {

                menu.classList.remove('show');
                menu.classList.remove('open-up');

            });

    }

});
