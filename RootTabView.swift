import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            ClockInView()
                .tabItem {
                    Label("Pointage", systemImage: "clock")
                }

            MonthHistoryView()
                .tabItem {
                    Label("Historique", systemImage: "calendar")
                }

            SettingsView()
                .tabItem {
                    Label("Réglages", systemImage: "gearshape")
                }
        }
    }
}
