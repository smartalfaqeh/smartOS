import QtQuick 2.0;
import calamares.slideshow 1.0;

Presentation {
    id: presentation
    Slide {
        Rectangle { anchors.fill: parent; color: "#06222a" }
        Text { anchors.centerIn: parent; horizontalAlignment: Text.AlignHCenter; color: "#e2fbf8"; font.pixelSize: 26
               text: "Selamat datang ke FaqehOS\nSistem pengendalian dengan AI di terasnya" }
    }
}
