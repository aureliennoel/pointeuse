import SwiftUI

struct MonthHistoryView: View {
    @State private var selectedMonth: Date = .now

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {

                // Sélecteur de mois (simple)
                monthPicker

                // Cartes résumé
                summaryCards

                // Liste (à brancher sur tes données)
                List {
                    Section("Jours") {
                        // TODO: remplacer par tes entrées du mois
                        ForEach(mockDays, id: \.date) { day in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(day.title)
                                        .font(.headline)
                                    Text(day.subtitle)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(day.total)
                                    .font(.headline)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)

            }
            .navigationTitle("Historique")
        }
    }

    private var monthPicker: some View {
        HStack {
            Button {
                selectedMonth = Calendar.current.date(byAdding: .month, value: -1, to: selectedMonth) ?? selectedMonth
            } label: {
                Image(systemName: "chevron.left")
            }

            Spacer()

            Text(selectedMonth, format: .dateTime.month(.wide).year())
                .font(.headline)

            Spacer()

            Button {
                selectedMonth = Calendar.current.date(byAdding: .month, value: 1, to: selectedMonth) ?? selectedMonth
            } label: {
                Image(systemName: "chevron.right")
            }
        }
        .padding(.horizontal)
    }

    private var summaryCards: some View {
        HStack(spacing: 12) {
            StatCard(title: "Heures", value: "148h")
            StatCard(title: "Jours", value: "18")
            StatCard(title: "Salaire", value: "1 420€")
        }
        .padding(.horizontal)
    }
}

private struct StatCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title3).bold()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct MockDay {
    let date: Date
    let title: String
    let subtitle: String
    let total: String
}

private let mockDays: [MockDay] = [
    .init(date: .now, title: "Lundi 3", subtitle: "10:00 → 18:00 (pause 30m)", total: "7h30"),
    .init(date: .now.addingTimeInterval(-86400), title: "Dimanche 2", subtitle: "Repos", total: "0h"),
]
